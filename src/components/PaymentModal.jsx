import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { PAYMENT_ACCOUNTS as DEFAULT_PAYMENT_ACCOUNTS } from '../utils/constants';

/**
 * Extracts Transaction Reference ID from OCR text using regex patterns
 */
export function extractTxnId(text, paymentMethod = 'telebirr') {
  if (!text) return '';

  // 1. CBE Specific: Starts with FT followed by 10-14 alphanumeric chars
  const cbeMatch = text.match(/FT[A-Z0-9]{10,14}/i);
  if (cbeMatch) return cbeMatch[0].toUpperCase();

  // 2. Telebirr / General Specific: Look for keywords like Transaction ID, Txn ID, Ref No
  const keywordMatch = text.match(/(?:Transaction\s*ID|Txn\s*ID|Ref\s*No|Reference|Ref)[:\s]*([A-Z0-9]{8,16})/i);
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1].toUpperCase();
  }

  // 3. Fallback Alphanumeric pattern: 10-12 alphanumeric characters (e.g., 9J82K3L10M)
  const telebirrMatch = text.match(/\b[A-Z0-9]{10,12}\b/i);
  if (telebirrMatch) return telebirrMatch[0].toUpperCase();

  return '';
}

/**
 * Checks bank_sms_logs in Supabase to see if a matching transaction exists
 */
export async function matchBankSms(txnId) {
  try {
    const cleanTxn = txnId.trim();
    if (!cleanTxn) return false;

    const { data, error } = await supabase
      .from('bank_sms_logs')
      .select('*')
      .or(`txn_id.eq.${cleanTxn},reference.eq.${cleanTxn},message.ilike.%${cleanTxn}%`)
      .limit(1);

    if (error) {
      console.warn('[PaymentModal] bank_sms_logs check warning:', error.message);
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    console.warn('[PaymentModal] bank_sms_logs check catch:', err);
    return false;
  }
}

export default function PaymentModal({ order, paymentMethod, onClose, onSuccess }) {
  const { showToast, paymentAccounts } = useApp();
  const [inputTab, setInputTab] = useState('manual'); // 'manual' or 'ocr'
  const [txnId, setTxnId] = useState('');
  const [detectedTxnId, setDetectedTxnId] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const activeAccounts = paymentAccounts || DEFAULT_PAYMENT_ACCOUNTS;
  const accountInfo = activeAccounts[paymentMethod] || DEFAULT_PAYMENT_ACCOUNTS[paymentMethod] || DEFAULT_PAYMENT_ACCOUNTS.telebirr;

  // Handle image selection for OCR
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setModalError('');

    // Perform client-side OCR automatically when screenshot selected
    await processImageOcr(file);
  };

  const processImageOcr = async (file) => {
    setIsProcessingOcr(true);
    setOcrProgress(0);
    setOcrStatus('Initializing OCR engine...');
    setDetectedTxnId('');

    let worker = null;
    try {
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

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      const extracted = extractTxnId(text, paymentMethod);
      if (extracted) {
        setDetectedTxnId(extracted);
        setTxnId(extracted);
        showToast(`Detected Txn ID: ${extracted}`, 'var(--color-success)');
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
    if (!finalTxnId) {
      setModalError('Transaction Reference ID is required.');
      return;
    }

    if (paymentMethod === 'cbe' && !/^FT/i.test(finalTxnId)) {
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

      // Query bank_sms_logs in Supabase to see if SMS containing txn_id exists
      const isBankMatched = await matchBankSms(finalTxnId);
      const newPaymentStatus = isBankMatched ? 'paid' : 'pending_verification';

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

      if (isBankMatched) {
        showToast('Payment Automatically Verified & Marked PAID! 🎉 Kitchen Notified!', 'var(--color-success)');
      } else {
        showToast('Submitted as Pending Verification. Cashier/Admin will verify shortly. ⏳', 'var(--color-warning)');
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
            Pay Order #{order.order_number} via {accountInfo.name || paymentMethod.toUpperCase()}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Dynamic Account Details Box */}
        <div style={{ backgroundColor: '#0f0f17', padding: '14px', borderRadius: '10px', border: '1px solid #2d2d42', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Amount to Pay</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>Br {parseFloat(order.total_price).toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>
            Transfer to: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: 15 }}>{accountInfo.number}</span>
            {accountInfo.name && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{accountInfo.name}</div>
            )}
          </div>
        </div>

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
