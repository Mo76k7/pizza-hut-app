import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { PAYMENT_ACCOUNTS } from '../utils/constants';

/**
 * Extracts Transaction Reference ID from OCR text using regex patterns
 */
export function extractPaymentData(text, paymentMethod = 'telebirr') {
  if (!text) return { txnId: '', amount: null, date: null, time: null };

  let txnId = '';
  // 1. CBE Specific: Starts with FT followed by 10-14 alphanumeric chars
  const cbeMatch = text.match(/FT[A-Z0-9]{10,14}/i);
  if (cbeMatch) txnId = cbeMatch[0].toUpperCase();
  else {
    // 2. Telebirr / General Specific: Look for keywords like Transaction ID, Txn ID, Ref No
    const keywordMatch = text.match(/(?:Transaction\s*ID|Txn\s*ID|Ref\s*No|Reference|Ref)[:\s]*([A-Z0-9]{8,16})/i);
    if (keywordMatch && keywordMatch[1]) {
      txnId = keywordMatch[1].toUpperCase();
    } else {
      // 3. Fallback Alphanumeric pattern: 10-12 alphanumeric characters
      const telebirrMatch = text.match(/\b[A-Z0-9]{10,12}\b/i);
      if (telebirrMatch) txnId = telebirrMatch[0].toUpperCase();
    }
  }

  let amount = null;
  const amtMatch = text.match(/(?:Amount|ETB|Br|Birr)[\s:]*([\d,]+\.?\d*)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  let date = null;
  let time = null;
  const dateMatch = text.match(/\b(\d{2,4}[-/]\d{1,2}[-/]\d{1,4})\b/);
  if (dateMatch) date = dateMatch[1];
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\b/);
  if (timeMatch) time = timeMatch[1];

  return { txnId, amount, date, time };
}

export async function matchBankSms(ocrData, manualTxnId, orderAmount) {
  try {
    const finalTxn = manualTxnId ? manualTxnId.trim() : (ocrData?.txnId || '');
    if (!finalTxn) return { matched: false, status: 'pending_verification' };

    // Rule 1: Duplicate Prevention
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('txn_id', finalTxn)
      .limit(1);
    
    if (existingOrder && existingOrder.length > 0) {
      return { 
        matched: false, 
        rejected: true, 
        errorMsg: 'Transaction already used. Payment rejected.' 
      };
    }

    const { data, error } = await supabase
      .from('bank_sms_logs')
      .select('*')
      .or(`txn_id.eq.${finalTxn},reference.eq.${finalTxn},message.ilike.%${finalTxn}%`)
      .limit(1);

    if (error) {
      console.warn('[PaymentModal] bank_sms_logs check warning:', error.message);
      return { matched: false, status: 'pending_verification' };
    }

    if (data && data.length > 0) {
      const log = data[0];
      const logAmount = parseFloat(log.amount) || 0;
      const requiredAmount = parseFloat(orderAmount) || 0;
      
      if (logAmount >= requiredAmount) {
        // Rule 3: Date match or OCR data check
        if (!ocrData || !ocrData.date) {
          return { matched: false, status: 'pending_verification' };
        }
        return { matched: true, status: 'auto_verified' };
      } else {
        return { 
          matched: false, 
          status: 'pending_verification',
          amountError: `Payment amount mismatch! Required: Br ${requiredAmount.toFixed(2)}, Received: Br ${logAmount.toFixed(2)}` 
        };
      }
    }
    
    return { matched: false, status: 'pending_verification' };
  } catch (err) {
    console.warn('[PaymentModal] bank_sms_logs check catch:', err);
    return { matched: false, status: 'pending_verification' };
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
  const [hasCopied, setHasCopied] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [detectedTxnId, setDetectedTxnId] = useState('');
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
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      });

      const { data: { text } } = await worker.recognize(optimizedImage);
      await worker.terminate();

      const extracted = extractPaymentData(text, paymentMethod);
      setExtractedData(extracted);
      if (extracted.txnId) {
        setDetectedTxnId(extracted.txnId);
        setTxnId(extracted.txnId);
        showToast(`Detected Txn ID: ${extracted.txnId}`, 'var(--color-success)');
      } else {
        setModalError('Could not auto-detect Transaction ID from image. Please verify text or enter manually.');
      }
    } catch (err) {
      console.error('[OCR Error]', err);
      setModalError('OCR process failed. Please type the Transaction ID manually.');
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (_) {}
      }
      setIsProcessingOcr(false);
    }
  };

  const handleSubmit = async () => {
    const finalTxnId = txnId.trim();
    if (!finalTxnId && !receiptFile) {
      setModalError('Transaction Reference ID is required.');
      return;
    }

    if (finalTxnId && paymentMethod === 'cbe' && !/^FT/i.test(finalTxnId)) {
      setModalError('CBE Transaction ID must start with FT (e.g. FT240123...)');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      let receiptUrl = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          receiptUrl = publicUrl;
        } else {
          console.warn('[PaymentModal] receipt upload warning:', uploadError);
        }
      }

      // Check match and status routing
      const matchResult = await matchBankSms(extractedData, finalTxnId, order.total_price);
      
      if (matchResult.rejected) {
        setModalError(matchResult.errorMsg);
        setIsSubmitting(false);
        return; // immediate rejection rule 1
      }
      
      if (matchResult.amountError) {
        showToast(matchResult.amountError, 'var(--color-warning)');
      }

      const newPaymentStatus = matchResult.status || 'pending_verification';

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          payment_method: paymentMethod,
          txn_id: finalTxnId,
          payment_status: newPaymentStatus,
          receipt_image_url: receiptUrl,
        })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

      if (newPaymentStatus === 'auto_verified') {
        showToast('Payment Auto-Verified! 🎉', 'var(--color-success)');
      } else {
        showToast('Waiting for restaurant approval... ⏳', 'var(--color-warning)');
      }

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
        className="modal-container"
        style={{
          maxWidth: 440,
          padding: 24,
          backgroundColor: '#181824',
          borderRadius: 16,
          border: '1px solid #2d2d3f',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>
            Pay Order #{order.order_number} via {accountInfo.name}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Account Details Box */}
        <div style={{ backgroundColor: '#0f0f17', padding: '14px', borderRadius: '10px', border: '1px solid #2d2d42', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Amount to Pay</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>Br {parseFloat(order.total_price).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>
              Account: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{accountInfo.number}</span>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(accountInfo.number);
                setHasCopied(true);
                showToast('Account number copied!', 'var(--color-success)');
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: '#fff', fontSize: 12, cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-copy"></i> Copy
            </button>
          </div>
        </div>

        {!hasCopied && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Please copy the account number and make the payment first.
          </div>
        )}

        {hasCopied && (
          <>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, backgroundColor: '#0f0f17', padding: 4, borderRadius: 10, border: '1px solid #29293d' }}>
          <button
            type="button"
            onClick={() => setInputTab('manual')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: inputTab === 'manual' ? 'var(--color-primary)' : 'transparent',
              color: inputTab === 'manual' ? '#fff' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ✍️ Enter Txn ID
          </button>
          <button
            type="button"
            onClick={() => setInputTab('ocr')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: inputTab === 'ocr' ? 'var(--color-primary)' : 'transparent',
              color: inputTab === 'ocr' ? '#fff' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            📸 Upload Screenshot
          </button>
        </div>

        {/* Tab Content */}
        {inputTab === 'manual' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
                Transaction Reference ID *
              </label>
              <input
                type="text"
                placeholder={paymentMethod === 'cbe' ? 'e.g. FT2401928374' : 'e.g. 9J82K3L10M'}
                value={txnId}
                onChange={(e) => { setTxnId(e.target.value); setModalError(''); }}
                style={{
                  width: '100%',
                  backgroundColor: '#0f0f17',
                  color: '#fff',
                  border: '1px solid #3f3f5a',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Receipt Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ width: '100%', color: '#fff', fontSize: 13 }}
              />
            </div>
          </div>
        ) : (
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
              <div style={{ textAlign: 'center', maxHeight: 120, overflow: 'hidden', borderRadius: 8, border: '1px solid #333' }}>
                <img src={previewUrl} alt="Receipt preview" style={{ height: '100%', objectFit: 'contain' }} />
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
        )}
        </>
        )}

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
