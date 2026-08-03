import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { PAYMENT_ACCOUNTS } from '../utils/constants';

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

  const amountMatch = text.match(/(?:ETB|Birr|Amount)[:\s]*([0-9,.]+)/i) || text.match(/([0-9,.]+)\s*(?:ETB|Birr)/i);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  const dateMatch = text.match(/\b(\d{2,4}[-/]\d{1,2}[-/]\d{1,4})\b/);
  if (dateMatch && dateMatch[1]) {
    date = dateMatch[1];
  }

  return { txnId, amount, date };
}

export async function matchBankSms(txnId, orderAmount) {
  try {
    const cleanTxn = txnId ? txnId.replace(/\s+/g, '').toUpperCase() : '';
    if (!cleanTxn) return { matched: false, error: 'Transaction ID is empty' };

    // 2. Database Lookup
    const { data, error } = await supabase
      .from('bank_sms_logs')
      .select('*')
      .eq('extracted_txn_id', cleanTxn)
      .limit(1);

    if (error) {
      console.warn('[PaymentModal] bank_sms_logs error:', error.message);
      return { matched: false, error: 'Database error checking transaction' };
    }

    // 3. Condition 1 (Not Found in SMS Logs)
    if (!data || data.length === 0) {
      return { 
        matched: false, 
        error: 'Invalid receipt. We have not received a matching bank SMS for this transaction ID. Please wait a moment if you just paid, or ensure you uploaded the correct receipt.' 
      };
    }

    const log = data[0];
    
    // 5. Condition 3 (Already Used)
    if (log.is_matched) {
      return { matched: false, error: 'This transaction has already been claimed.' };
    }
    
    // 4. Condition 2 (Insufficient Amount)
    const logAmount = parseFloat(log.extracted_amount) || 0;
    const requiredAmount = parseFloat(orderAmount) || 0;
    
    if (logAmount < requiredAmount) {
      return { 
        matched: false, 
        error: 'The paid amount on this receipt is less than the required order total.' 
      };
    }

    // 6. Success Path
    return { matched: true, logId: log.id };
  } catch (err) {
    console.warn('[PaymentModal] bank_sms_logs catch:', err);
    return { matched: false, error: 'Error validating transaction' };
  }
}

const resizeImage = (file, maxWidth = 800) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function PaymentModal({ order, paymentMethod, onClose, onSuccess }) {
  const { showToast } = useApp();
  const [inputTab, setInputTab] = useState('manual'); // 'manual' or 'ocr'
  const [txnId, setTxnId] = useState('');
  const [detectedTxnId, setDetectedTxnId] = useState('');
  const [detectedAmount, setDetectedAmount] = useState(null);
  const [detectedDate, setDetectedDate] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const accountInfo = PAYMENT_ACCOUNTS[paymentMethod] || PAYMENT_ACCOUNTS.telebirr;

  // Handle image selection for OCR
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setModalError('');

    // Perform client-side OCR automatically in background
    await processImageOcr(file);
  };

  const processImageOcr = async (file) => {
    setIsProcessingOcr(true);
    setOcrProgress(0);
    setOcrStatus('Optimizing image...');
    setDetectedTxnId('');

    let worker = null;
    try {
      const optimizedImage = await resizeImage(file, 800);
      setOcrStatus('Initializing OCR worker...');

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrStatus(`Extracting text from receipt... ${Math.round((m.progress || 0) * 100)}%`);
            setOcrProgress(Math.round((m.progress || 0) * 100));
          } else {
            setOcrStatus(m.status);
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
      });

      const { data: { text } } = await worker.recognize(optimizedImage);
      console.log('[OCR Extracted Text]:\n', text); // Requirement 1: Console log the OCR extracted text
      await worker.terminate();

      const { txnId: extractedTxn, amount: extractedAmt, date: extractedDate } = extractPaymentDetails(text, paymentMethod);
      if (extractedTxn) {
        const cleanTxnId = extractedTxn.replace(/\s+/g, '').toUpperCase();
        setDetectedTxnId(cleanTxnId);
        setTxnId(cleanTxnId);
        setDetectedAmount(extractedAmt);
        setDetectedDate(extractedDate);
        showToast(`Detected Txn ID: ${cleanTxnId}`, 'var(--color-success)');
      } else {
        // Fail 1 (Unrelated Image/No Text)
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
      if (worker) {
        try { await worker.terminate(); } catch (_) {}
      }
      setIsProcessingOcr(false);
    }
  };

  const handleSubmit = async () => {
    const finalTxnId = txnId.trim();
    if (!finalTxnId || !receiptFile) {
      setModalError('Please upload a valid payment receipt screenshot.');
      return;
    }

    if (finalTxnId && paymentMethod === 'cbe' && !/^FT/i.test(finalTxnId)) {
      setModalError('CBE Transaction ID must start with FT (e.g. FT240123...)');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      // Check if real-time matching with bank_sms_logs succeeds BEFORE uploading anything
      const matchResult = await matchBankSms(finalTxnId, order.total_price);
      
      if (!matchResult.matched) {
        setModalError(matchResult.error || 'Transaction validation failed.');
        setIsSubmitting(false);
        return; // Reject payment immediately
      }

      let receiptUrl = null;
      
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        console.error('[PaymentModal] receipt upload error:', uploadError);
        setModalError('Failed to upload the receipt image. Please check your connection and try again.');
        setIsSubmitting(false);
        return; // Halt submission
      }

      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);
        
      if (data && data.publicUrl) {
        receiptUrl = data.publicUrl;
      } else {
        setModalError('Failed to retrieve the receipt image URL. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // If valid, insert to payment_proofs, update bank_sms_logs, update order
      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          order_id: order.id,
          screenshot_url: receiptUrl || '',
          ocr_txn_id: finalTxnId,
          ocr_amount: detectedAmount,
          ocr_date: detectedDate ? new Date(detectedDate).toISOString() : null,
          status: 'pending_admin'
        });

      if (proofError) console.warn('[PaymentModal] proof insert error:', proofError);

      await supabase
        .from('bank_sms_logs')
        .update({ is_matched: true })
        .eq('id', matchResult.logId);

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          payment_method: paymentMethod,
          txn_id: finalTxnId,
          payment_status: 'pending',
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

  return (
    <div className="modal-overlay" style={{ zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div
        className="modal-container w-full max-w-[95vw] md:max-w-md mx-auto p-4 overflow-hidden box-border"
        style={{
          width: '95%',
          maxWidth: '440px',
          padding: 24,
          backgroundColor: '#181824',
          borderRadius: 16,
          border: '1px solid #2d2d3f',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <h3 className="whitespace-normal text-center" style={{ margin: 0, color: '#fff', fontSize: 18, flex: 1, wordBreak: 'break-word', textAlign: 'center', whiteSpace: 'normal' }}>
            Pay Order #{order.order_number} via {accountInfo.name}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#999', fontSize: 24, cursor: 'pointer', paddingLeft: 10 }}
          >
            ×
          </button>
        </div>

        {/* Account Details Box */}
        <div style={{ backgroundColor: '#0f0f17', padding: '14px', borderRadius: '10px', border: '1px solid #2d2d42', marginBottom: 16, boxSizing: 'border-box', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Amount to Pay</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>Br {parseFloat(order.total_price).toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ wordBreak: 'break-all' }}>Account: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{accountInfo.number}</span></span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(accountInfo.number);
                showToast('Number copied to clipboard!', 'var(--color-success)');
              }}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#3b82f6',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <i className="fa-regular fa-copy" style={{ marginRight: 4 }} /> Copy
            </button>
          </div>
        </div>

        {/* Tab Content - Forced OCR Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
              Upload Payment Receipt Screenshot *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ width: '100%', color: '#fff', fontSize: 13 }}
            />
          </div>

          {previewUrl && (
            <div style={{ textAlign: 'center', maxHeight: 200, overflow: 'hidden', borderRadius: 8, border: '1px solid #333', width: '100%' }}>
              <img src={previewUrl} alt="Receipt preview" className="max-w-full h-auto max-h-48 object-contain rounded-md" style={{ maxWidth: '100%', height: 'auto', maxHeight: '192px', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          )}

          {isProcessingOcr && (
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ color: '#3b82f6', marginRight: 8 }} />
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>{ocrStatus}</span>
            </div>
          )}

          {detectedTxnId && (
            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                ✓ Detected Txn ID: <span style={{ fontFamily: 'monospace', fontSize: 15, textDecoration: 'underline' }}>{detectedTxnId}</span>
              </div>
              <input
                type="text"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                placeholder="Confirm or edit Txn ID"
                style={{
                  width: '100%',
                  backgroundColor: '#0f0f17',
                  color: '#fff',
                  border: '1px solid #3f3f5a',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                  marginTop: 4,
                }}
              />
            </div>
          )}
        </div>

        {/* Error message */}
        {modalError && (
          <div style={{ color: '#ef4444', fontSize: 13, backgroundColor: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
            {modalError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessingOcr}
            style={{ flex: 2, margin: 0, padding: 12 }}
          >
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Verifying...</>
            ) : (
              'Submit Payment'
            )}
          </button>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ flex: 1, margin: 0, padding: 12 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
