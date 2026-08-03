import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { PAYMENT_ACCOUNTS } from '../utils/constants';

// ─────────────────────────────────────────────
// Helper: Extract txn_id, amount, date from OCR text
// ─────────────────────────────────────────────
export function extractPaymentDetails(text, paymentMethod = 'telebirr') {
  let txnId = '';
  let amount = null;
  let date = null;

  if (!text) return { txnId, amount, date };

  if (paymentMethod === 'cbe') {
    const cbeMatch = text.match(/FT[A-Z0-9]{10,14}/i);
    if (cbeMatch) txnId = cbeMatch[0].toUpperCase().replace(/\s+/g, '');
  } else {
    const telebirrMatch = text.match(/(?:Transaction\s*ID|Txn\s*ID|Ref\s*No|Reference|Ref)[:\s]*([A-Z0-9]{8,16})/i);
    if (telebirrMatch && telebirrMatch[1]) {
      txnId = telebirrMatch[1].toUpperCase().replace(/\s+/g, '');
    } else {
      const fallbackMatch = text.match(/\b[A-Z0-9]{10,12}\b/i);
      if (fallbackMatch) txnId = fallbackMatch[0].toUpperCase().replace(/\s+/g, '');
    }
  }

  const amountMatch =
    text.match(/(?:ETB|Birr|Amount)[:\s]*([0-9,.]+)/i) ||
    text.match(/([0-9,.]+)\s*(?:ETB|Birr)/i);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  const dateMatch = text.match(/\b(\d{2,4}[-/]\d{1,2}[-/]\d{1,4})\b/);
  if (dateMatch && dateMatch[1]) date = dateMatch[1];

  return { txnId, amount, date };
}

// ─────────────────────────────────────────────
// Helper: Validate against bank_sms_logs
// ─────────────────────────────────────────────
export async function matchBankSms(txnId, orderAmount) {
  try {
    const cleanTxn = txnId ? txnId.replace(/\s+/g, '').toUpperCase() : '';
    if (!cleanTxn) return { matched: false, error: 'Transaction ID is empty' };

    // 2. Database Lookup — CRITICAL STEP
    const { data, error } = await supabase
      .from('bank_sms_logs')
      .select('*')
      .eq('extracted_txn_id', cleanTxn)
      .limit(1);

    if (error) {
      console.warn('[PaymentModal] bank_sms_logs error:', error.message);
      return { matched: false, error: 'Database error checking transaction' };
    }

    // 3. Condition 1 — Not Found in SMS Logs
    if (!data || data.length === 0) {
      return {
        matched: false,
        error:
          'Invalid receipt. We have not received a matching bank SMS for this transaction ID. ' +
          'Please wait a moment if you just paid, or ensure you uploaded the correct receipt.',
      };
    }

    const log = data[0];

    // 5. Condition 3 — Already Used
    if (log.is_matched) {
      return { matched: false, error: 'This transaction has already been claimed.' };
    }

    // 4. Condition 2 — Insufficient Amount
    const logAmount = parseFloat(log.extracted_amount) || 0;
    const requiredAmount = parseFloat(orderAmount) || 0;

    if (logAmount < requiredAmount) {
      return {
        matched: false,
        error: 'The paid amount on this receipt is less than the required order total.',
      };
    }

    // 6. Success Path
    return { matched: true, logId: log.id };
  } catch (err) {
    console.warn('[PaymentModal] bank_sms_logs catch:', err);
    return { matched: false, error: 'Error validating transaction' };
  }
}

// ─────────────────────────────────────────────
// Helper: Resize image for faster OCR
// ─────────────────────────────────────────────
const resizeImage = (file, maxWidth = 800) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─────────────────────────────────────────────
// PaymentModal Component — 100% Tailwind, zero inline styles
// ─────────────────────────────────────────────
export default function PaymentModal({ order, paymentMethod, onClose, onSuccess }) {
  const { showToast } = useApp();

  const [txnId, setTxnId]                     = useState('');
  const [detectedTxnId, setDetectedTxnId]     = useState('');
  const [detectedAmount, setDetectedAmount]   = useState(null);
  const [detectedDate, setDetectedDate]       = useState(null);
  const [receiptFile, setReceiptFile]         = useState(null);
  const [previewUrl, setPreviewUrl]           = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrStatus, setOcrStatus]             = useState('');
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [modalError, setModalError]           = useState('');

  const accountInfo = PAYMENT_ACCOUNTS[paymentMethod] || PAYMENT_ACCOUNTS.telebirr;

  // ── OCR pipeline ──────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setModalError('');
    await processImageOcr(file);
  };

  const processImageOcr = async (file) => {
    setIsProcessingOcr(true);
    setOcrStatus('Optimizing image...');
    setDetectedTxnId('');
    setTxnId('');

    let worker = null;
    try {
      const optimizedImage = await resizeImage(file, 800);
      setOcrStatus('Initializing OCR worker...');

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrStatus(`Extracting text... ${Math.round((m.progress || 0) * 100)}%`);
          } else {
            setOcrStatus(m.status);
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
      });

      const { data: { text } } = await worker.recognize(optimizedImage);
      console.log('[OCR Extracted Text]:\n', text);
      await worker.terminate();

      const { txnId: extractedTxn, amount: extractedAmt, date: extractedDate } =
        extractPaymentDetails(text, paymentMethod);

      if (extractedTxn) {
        const clean = extractedTxn.replace(/\s+/g, '').toUpperCase();
        setDetectedTxnId(clean);
        setTxnId(clean);
        setDetectedAmount(extractedAmt);
        setDetectedDate(extractedDate);
        showToast(`Detected Txn ID: ${clean}`, 'var(--color-success)');
      } else {
        // Fail 1 — No recognisable transaction ID found
        setModalError('Could not read transaction ID from image. Please upload a clear receipt.');
        setReceiptFile(null);
        setPreviewUrl(null);
      }
    } catch (err) {
      console.error('[OCR Error]', err);
      setModalError('Could not read transaction ID from image. Please upload a clear receipt.');
      setReceiptFile(null);
      setPreviewUrl(null);
    } finally {
      if (worker) { try { await worker.terminate(); } catch (_) {} }
      setIsProcessingOcr(false);
    }
  };

  // ── Submission pipeline ──────────────────────────────────────────────
  const handleSubmit = async () => {
    const finalTxnId = txnId.trim();

    if (!finalTxnId || !receiptFile) {
      setModalError('Please upload a valid payment receipt screenshot.');
      return;
    }
    if (paymentMethod === 'cbe' && !/^FT/i.test(finalTxnId)) {
      setModalError('CBE Transaction ID must start with FT (e.g. FT240123...)');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      // Step 1 — Validate against bank_sms_logs BEFORE touching storage
      const matchResult = await matchBankSms(finalTxnId, order.total_price);
      if (!matchResult.matched) {
        setModalError(matchResult.error || 'Transaction validation failed.');
        return;
      }

      // Step 2 — Upload screenshot (hard-fail if storage upload fails)
      const fileExt  = receiptFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        console.error('[PaymentModal] receipt upload error:', uploadError);
        setModalError('Failed to upload the receipt image. Please check your connection and try again.');
        return;
      }

      // Step 3 — Retrieve public URL
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
      if (!urlData?.publicUrl) {
        setModalError('Failed to retrieve the receipt image URL. Please try again.');
        return;
      }
      const receiptUrl = urlData.publicUrl;

      // Step 4 — Insert payment_proof row
      const { error: proofError } = await supabase.from('payment_proofs').insert({
        order_id:       order.id,
        screenshot_url: receiptUrl,
        ocr_txn_id:     finalTxnId,
        ocr_amount:     detectedAmount,
        ocr_date:       detectedDate ? new Date(detectedDate).toISOString() : null,
        status:         'pending_admin',
      });
      if (proofError) console.warn('[PaymentModal] proof insert error:', proofError);

      // Step 5 — Lock the SMS log so it cannot be reused
      await supabase
        .from('bank_sms_logs')
        .update({ is_matched: true })
        .eq('id', matchResult.logId);

      // Step 6 — Update order with receipt URL
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          payment_method:    paymentMethod,
          txn_id:            finalTxnId,
          payment_status:    'pending',
          receipt_image_url: receiptUrl,
        })
        .eq('id', order.id);
      if (updateErr) throw updateErr;

      showToast('Payment Received — Waiting for Admin Final Approval', 'var(--color-warning)');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('[PaymentModal] submit error:', err);
      setModalError(err.message || 'Error submitting payment reference.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    /* Main Background Overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

      {/* Modal Container — mobile-first, never overflows screen */}
      <div className="w-full max-w-sm bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <h3 className="text-lg font-bold text-white whitespace-normal break-words leading-tight w-full px-2">
            Pay Order #{order.order_number}
            <span className="block text-sm font-normal text-gray-400 mt-0.5">
              via {accountInfo.name}
            </span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-white text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto max-h-[65vh]">

          {/* Account Details */}
          <div className="bg-gray-800/60 rounded-lg p-3 border border-white/10">
            <div className="w-full flex items-center justify-between gap-2 overflow-hidden mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Amount to Pay</span>
              <span className="text-xl font-bold text-yellow-400 shrink-0">
                Br {parseFloat(order.total_price).toFixed(2)}
              </span>
            </div>
            <div className="w-full flex items-center justify-between gap-2 overflow-hidden">
              <span className="text-sm text-white font-semibold truncate">
                Account:{' '}
                <span className="font-mono text-red-400">{accountInfo.number}</span>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(accountInfo.number);
                  showToast('Number copied!', 'var(--color-success)');
                }}
                className="flex-shrink-0 flex items-center gap-1 bg-blue-500/20 border border-blue-500/40
                           text-blue-400 text-xs font-semibold px-2 py-1 rounded
                           hover:bg-blue-500/30 transition-colors"
              >
                <i className="fa-regular fa-copy" /> Copy
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Upload Payment Receipt Screenshot <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-300
                         file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0
                         file:text-sm file:font-semibold file:bg-red-600 file:text-white
                         hover:file:bg-red-700 cursor-pointer"
            />
          </div>

          {/* Image Preview */}
          {previewUrl && (
            <div className="w-full rounded-lg overflow-hidden border border-white/10 max-h-36 bg-black flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-h-36 object-contain"
              />
            </div>
          )}

          {/* OCR Progress */}
          {isProcessingOcr && (
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <i className="fa-solid fa-spinner fa-spin text-blue-400" />
              <span className="text-sm text-blue-300 font-semibold">{ocrStatus}</span>
            </div>
          )}

          {/* Detected Txn ID display */}
          {detectedTxnId && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex flex-col gap-2">
              <p className="text-xs text-green-400 font-semibold">
                ✓ Detected Transaction ID:
              </p>
              <p className="text-green-400 font-semibold break-all whitespace-normal font-mono text-sm">
                {detectedTxnId}
              </p>
              <input
                type="text"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                placeholder="Confirm or correct Txn ID"
                className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-md
                           px-3 py-2 outline-none focus:border-green-500 transition-colors"
              />
            </div>
          )}

          {/* Error Message */}
          {modalError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 text-center">
              <i className="fa-solid fa-triangle-exclamation mr-1" />
              {modalError}
            </div>
          )}

        </div>

        {/* Bottom Buttons — stacked vertically on mobile */}
        <div className="w-full flex flex-col gap-3 mt-4 px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessingOcr}
            className="w-full flex items-center justify-center gap-2 bg-red-600
                       hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed
                       text-white font-bold py-3 rounded-lg transition-colors text-sm"
          >
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Verifying...</>
            ) : isProcessingOcr ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Reading Receipt...</>
            ) : (
              <><i className="fa-solid fa-paper-plane" /> Submit Payment</>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-white/5
                       hover:bg-white/10 disabled:opacity-60 text-gray-300 font-semibold
                       py-3 rounded-lg border border-white/10 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

