import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { PAYMENT_ACCOUNTS } from '../utils/constants';

export default function PaymentModal({ order, paymentMethod, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const accountInfo = PAYMENT_ACCOUNTS[paymentMethod] || PAYMENT_ACCOUNTS.telebirr;

  const handleUpload = async () => {
    if (!file) {
      setError('Please upload a screenshot of your payment receipt.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${order.id}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(`receipts/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "payment_proofs" not found. Please contact admin.');
        }
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('payment_proofs')
        .getPublicUrl(`receipts/${fileName}`);
        
      const receiptUrl = publicUrlData.publicUrl;

      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          order_id: order.id,
          receipt_url: receiptUrl,
          status: 'pending'
        });

      if (proofError) throw proofError;

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: 'pending_verification', payment_method: paymentMethod })
        .eq('id', order.id);

      if (updateError) throw updateError;

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        display: 'flex',
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet"
        style={{
          maxWidth: '460px',
          width: '90%',
          margin: 'auto',
          borderRadius: '20px',
          padding: '24px',
          backgroundColor: '#181824',
          border: '1px solid #2d2d3f',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="modal-close" 
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <h2 style={{ marginBottom: 16, color: '#fff', fontSize: '20px', marginTop: 0 }}>Complete Payment</h2>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 8 }}>Please transfer <strong>Br {order.total_price}</strong> to:</p>
          <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>{accountInfo.name}</div>
          <div style={{ fontSize: 24, letterSpacing: '1px', color: 'var(--color-accent)' }}>{accountInfo.number}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{paymentMethod}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#fff' }}>Upload Receipt Screenshot <span className="required-star" style={{ color: 'var(--color-error)' }}>*</span></label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '10px', backgroundColor: '#0f0f17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div className="field-error-msg show" style={{ marginBottom: 16, color: 'var(--color-error)', fontSize: '13px' }}>{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleUpload} 
          disabled={loading}
          style={{ width: '100%', margin: 0 }}
        >
          {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Uploading...</> : <><i className="fa-solid fa-cloud-arrow-up" /> Submit Receipt</>}
        </button>
      </div>
    </div>
  );
}
