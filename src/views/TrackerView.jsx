import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { PAYMENT_ACCOUNTS } from '../utils/constants';
import RatingModal from '../components/RatingModal';
import PaymentModal from '../components/PaymentModal';
import Tesseract from 'tesseract.js';

const STATUS_STEPS = ['received', 'ready'];

const STATUS_META = {
  received:  { icon: 'fa-clock',          color: 'var(--color-warning)',  pulse: true  },
  accepted:  { icon: 'fa-thumbs-up',      color: 'var(--color-success)', pulse: true  },
  preparing: { icon: 'fa-fire-burner',    color: '#3B82F6',              pulse: true  },
  ready:     { icon: 'fa-bell',           color: 'var(--color-success)', pulse: false },
  completed: { icon: 'fa-circle-check',   color: 'var(--color-success)', pulse: false },
  rejected:  { icon: 'fa-circle-xmark',  color: 'var(--color-error)',   pulse: false },
};

export default function TrackerView({ onNavigate }) {
  const { activeOrderIds, removeActiveOrderId, t } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRatingOrder, setActiveRatingOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!activeOrderIds || activeOrderIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), payment_proofs(status, rejection_reason)')
        .in('id', activeOrderIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      // Check if any order is paid and unrated -> prompt rating
      const unrated = (data || []).find((ord) => {
        if (ord.payment_status === 'paid') {
          return !localStorage.getItem(`rated_order_${ord.id}`);
        }
        return false;
      });
      if (unrated) {
        setActiveRatingOrder(unrated);
      }
    } catch (err) {
      console.error('[TrackerView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOrderIds]);

  useEffect(() => {
    fetchOrders();

    if (!activeOrderIds || activeOrderIds.length === 0) return;

    let channel = supabase.channel('orders-realtime-tracker');

    // Subscribe specifically to UPDATE events for each active order ID
    activeOrderIds.forEach((id) => {
      channel = channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => {
          fetchOrders();
        }
      );
    });

    // Keep bank_sms_logs subscription
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bank_sms_logs' },
      () => {
        fetchOrders();
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, activeOrderIds]);

  const handleRatingSubmitted = (orderId) => {
    localStorage.setItem(`rated_order_${orderId}`, 'true');
    removeActiveOrderId(orderId);
    setActiveRatingOrder(null);
    fetchOrders();
  };

  if (!activeOrderIds || activeOrderIds.length === 0 || (orders.length === 0 && !loading)) {
    return (
      <div className="app-view" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="empty-cart-icon">🍕</div>
        <h3 style={{ color: '#fff', marginBottom: 8 }}>{t('no_active_orders') || 'No active orders'}</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 20, fontSize: 14 }}>
          Place an order to track it here.
        </p>
        <button className="btn-primary" onClick={() => onNavigate('home')}>
          <i className="fa-solid fa-pizza-slice" /> {t('menu_nav') || 'Browse Menu'}
        </button>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return <TrackerSkeleton />;
  }

  return (
    <div className="app-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="display-title" style={{ fontSize: 'clamp(20px,5vw,28px)', margin: 0 }}>
          {t('order_status')} ({orders.length})
        </h1>
        <button
          className="btn-secondary"
          onClick={() => onNavigate('home')}
          style={{ padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', margin: 0 }}
        >
          <i className="fa-solid fa-plus" /> {t('new_order') || 'Add Order'}
        </button>
      </div>

      {/* List of active order cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {orders.map((order) => (
          <OrderTicketCard
            key={order.id}
            order={order}
            t={t}
            onOpenRating={() => setActiveRatingOrder(order)}
            onRemoveOrder={() => removeActiveOrderId(order.id)}
            onRefresh={fetchOrders}
          />
        ))}
      </div>

      {/* Post-Payment Rating & Feedback Modal */}
      {activeRatingOrder && (
        <RatingModal
          order={activeRatingOrder}
          onClose={() => setActiveRatingOrder(null)}
          onSubmitted={() => handleRatingSubmitted(activeRatingOrder.id)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// OrderTicketCard — Renders individual active order
// ──────────────────────────────────────────────
function OrderTicketCard({ order, t, onOpenRating, onRemoveOrder, onRefresh }) {
  const { showToast } = useApp();
  const [selectedPayment, setSelectedPayment] = useState('telebirr');
  const [txId, setTxId] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [copied, setCopied] = useState(false);

  const status = order?.status || 'received';
  const isRejected = status === 'rejected' || status === 'cancelled';
  const meta = STATUS_META[status] || STATUS_META.received;
  const isPaid = order.payment_status === 'paid' || order.payment_status === 'approved';
  const isPendingVerification = order.payment_status === 'pending_verification' || order.payment_status === 'pending';
  const isRejectedPayment = order.payment_status === 'rejected';
  const isUnpaid = order.payment_status === 'unpaid' || !order.payment_status;
  const isRated = localStorage.getItem(`rated_order_${order.id}`);
  const isCancelable = status === 'received';

  let rejectionReason = null;
  if (isRejectedPayment && order.payment_proofs) {
    const rejectedProofs = [...order.payment_proofs].filter(p => p.status === 'rejected' && p.rejection_reason);
    if (rejectedProofs.length > 0) rejectionReason = rejectedProofs[rejectedProofs.length - 1].rejection_reason;
  }

  const handleCancelOrder = async () => {
    if (!isCancelable) return;
    if (!window.confirm(`Are you sure you want to cancel Order #${order.order_number}?`)) return;

    try {
      const { error: cancelErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);

      if (cancelErr) throw cancelErr;

      showToast(`Order #${order.order_number} has been cancelled.`, 'var(--color-warning)');
      onRemoveOrder();
    } catch (err) {
      console.error('Cancel order error:', err);
      showToast(`Failed to cancel order: ${err.message}`, 'var(--color-error)');
    }
  };

  const handleCashCheckout = async () => {
    try {
      await supabase
        .from('orders')
        .update({ payment_method: 'cash', payment_status: 'unpaid' })
        .eq('id', order.id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const accountInfo = PAYMENT_ACCOUNTS[selectedPayment];

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptFile(null);
      setReceiptPreview(null);
    }
  };

  const handleSubmitDigitalPayment = async () => {
    if (!txId.trim() && !receiptFile) {
      setPaymentError('Please provide either a Transaction ID or upload a screenshot.');
      return;
    }
    
    setIsSubmittingPayment(true);
    setPaymentError(null);

    try {
      // Duplicate Txn ID check
      if (txId.trim()) {
        const { data: dupData, error: dupError } = await supabase
          .from('orders')
          .select('id')
          .eq('txn_id', txId.trim())
          .neq('id', order.id)
          .limit(1);
          
        if (dupError) throw dupError;
        if (dupData && dupData.length > 0) {
          setPaymentError('This Transaction ID has already been used.');
          setIsSubmittingPayment(false);
          return;
        }
      }

      let receiptUrl = null;
      let ocrMatchedAmount = false;
      let ocrTxnMatched = false;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${order.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(`receipts/${fileName}`, receiptFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('payment_proofs')
          .getPublicUrl(`receipts/${fileName}`);
          
        receiptUrl = publicUrlData.publicUrl;

        // Perform OCR
        try {
          const { data: { text } } = await Tesseract.recognize(receiptFile, 'eng');
          const expectedAmount = parseFloat(order.total_price).toFixed(2);
          const amountWithoutDecimals = Math.floor(order.total_price).toString();
          
          if (text.includes(expectedAmount) || text.includes(amountWithoutDecimals)) {
            ocrMatchedAmount = true;
          }
          
          if (txId.trim() && text.includes(txId.trim())) {
            ocrTxnMatched = true;
          } else if (!txId.trim()) {
            ocrTxnMatched = true; 
          }
        } catch (ocrErr) {
          console.error("OCR failed:", ocrErr);
        }
      }

      const isAutoVerified = ocrMatchedAmount && ocrTxnMatched;
      const initialProofStatus = isAutoVerified ? 'approved' : 'pending';
      const initialOrderStatus = isAutoVerified ? 'approved' : 'pending_verification';

      const insertData = {
        order_id: order.id,
        receipt_url: receiptUrl,
        status: initialProofStatus
      };
      
      if (txId.trim()) {
        insertData.transaction_id = txId.trim();
      }

      if (isAutoVerified) {
        insertData.ocr_amount = order.total_price;
        if (txId.trim()) insertData.ocr_txn_id = txId.trim();
      }

      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert(insertData);

      if (proofError) {
        if (proofError.message && proofError.message.includes('transaction_id')) {
          console.warn('transaction_id column might not exist, retrying without it');
          delete insertData.transaction_id;
          const { error: fallbackError } = await supabase.from('payment_proofs').insert(insertData);
          if (fallbackError) throw fallbackError;
        } else {
          throw proofError;
        }
      }

      const updatePayload = { 
        payment_status: initialOrderStatus, 
        payment_method: selectedPayment 
      };
      if (txId.trim()) updatePayload.txn_id = txId.trim();

      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (updateError) throw updateError;

      if (isAutoVerified) {
        showToast('Payment Auto-Verified successfully!', 'var(--color-success)');
      } else {
        showToast('Payment submitted for verification!', 'var(--color-success)');
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      setPaymentError(err.message || 'Failed to submit payment. Please try again.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const timelineSteps = isRejected
    ? [
        { label: t('status_received'), done: true },
        { label: t('status_rejected'), done: true, isReject: true },
      ]
    : STATUS_STEPS.map((s) => ({
        id: s,
        label: t(`status_${s}`),
        done: STATUS_STEPS.indexOf(s) <= STATUS_STEPS.indexOf(status),
        active: s === status,
        isPreparing: s === 'preparing' && status === 'preparing',
      }));

  return (
    <div className="tracker-card" style={{ position: 'relative' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 700 }}>
            {order.order_number}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 10 }}>
            • {t('table')} {order.table_number}
          </span>
        </div>

        {/* Payment Status Pill */}
        {isPaid ? (
          <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            PAID ✅
          </span>
        ) : isPendingVerification ? (
          <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            Waiting for Admin Approval ⏳
          </span>
        ) : isRejectedPayment ? (
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            Payment Rejected ❌
          </span>
        ) : (
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            UNPAID 💳
          </span>
        )}
      </div>

      {isPaid && (
        <div style={{ marginBottom: 16, padding: 10, backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 8, color: '#22c55e', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          ✨ Payment Verified & Approved! Your order is being prepared.
        </div>
      )}

      {/* Order Status Title */}
      <h3 style={{ fontSize: 'clamp(17px,4vw,20px)', marginBottom: 16, color: '#FFF', textAlign: 'center' }}>
        {isRejected ? t('status_rejected') : t(`status_${status}`)}
      </h3>

      {/* Timeline Steps */}
      <div className="timeline">
        {timelineSteps.map((step, i) => {
          let cls = 'timeline-step';
          if (step.isReject) cls += ' active';
          else if (step.done && step.active) cls += ' active';
          else if (step.done && !step.active) cls += ' active';
          if (step.isPreparing) cls += ' preparing';
          return (
            <div key={i} className={cls} id={`step-${i + 1}`}>
              {step.label}
            </div>
          );
        })}
      </div>

      {/* Items List */}
      {order.order_items && order.order_items.length > 0 && (
        <div style={{ marginTop: 14, backgroundColor: '#0f0f17', padding: 12, borderRadius: 8, border: '1px solid #28283a' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
            Items Ordered
          </div>
          {order.order_items.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#fff', marginBottom: 4 }}>
              <span>{it.quantity}x {it.item_name} {it.selected_size ? `(${it.selected_size})` : ''}</span>
              <span>Br {(it.price_at_order * it.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Price Summary */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--glass-border)', textAlign: 'left' }}>
        <div className="summary-row">
          <span>{t('subtotal')}</span>
          <span>Br {parseFloat(order.subtotal || 0).toFixed(2)}</span>
        </div>
        <div className="summary-row tax-row">
          <span>VAT (15%)</span>
          <span>Br {parseFloat(order.vat || 0).toFixed(2)}</span>
        </div>
        <div className="summary-row tax-row">
          <span>{t('service')}</span>
          <span>Br {parseFloat(order.service_fee || 0).toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>{t('total')}</span>
          <span>Br {parseFloat(order.total_price || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Selection & Pay Button (When Unpaid or Rejected) */}
      {(isUnpaid || isRejectedPayment) && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
          {isRejectedPayment && (
            <div style={{ marginBottom: 12, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8 }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                <i className="fa-solid fa-triangle-exclamation" /> Payment Verification Failed
              </div>
              <div style={{ color: '#ffcdcd', fontSize: 13 }}>
                {rejectionReason || 'Your uploaded receipt could not be verified.'}
              </div>
              <div style={{ color: '#ccc', fontSize: 12, marginTop: 4 }}>
                Please check your transaction details and retry.
              </div>
            </div>
          )}
          <h4 style={{ color: '#fff', marginBottom: 10, fontSize: 14 }}>{t('payment_method')}</h4>

          <div className="payment-shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: 16 }}>
            {[
              { id: 'telebirr', label: 'Telebirr', icon: 'fa-mobile-screen' },
              { id: 'cbe',      label: 'CBE Birr', icon: 'fa-building-columns' },
              { id: 'cash',     label: t('cash'),  icon: 'fa-money-bill' },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                className={`payment-btn ${selectedPayment === id ? 'selected' : ''}`}
                onClick={() => setSelectedPayment(id)}
                style={{
                  width: '100%',
                  padding: '8px 4px',
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  borderRadius: '12px',
                  backgroundColor: selectedPayment === id ? 'var(--color-accent, #F59E0B)' : 'rgba(255,255,255,0.05)',
                  color: selectedPayment === id ? '#000' : '#fff',
                  border: selectedPayment === id ? '1px solid var(--color-accent, #F59E0B)' : '1px solid rgba(255,255,255,0.1)',
                  fontWeight: selectedPayment === id ? '700' : '500'
                }}
              >
                <i className={`fa-solid ${selectedPayment === id ? 'fa-circle-check' : icon}`} style={{ margin: 0 }} />
                {label}
              </button>
            ))}
          </div>

          {/* Inline Digital Payment Details */}
          {selectedPayment !== 'cash' && accountInfo && (
            <div style={{ backgroundColor: '#0f0f17', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #28283a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Transfer To</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{accountInfo.name}</div>
                  <div style={{ fontSize: 20, color: 'var(--color-accent)', fontWeight: 800, letterSpacing: '1px', marginTop: 4 }}>
                    {accountInfo.number}
                  </div>
                </div>
                <button 
                  onClick={() => handleCopy(accountInfo.number)}
                  className="btn-secondary" 
                  style={{ margin: 0, padding: '6px 10px', fontSize: 12, width: 'auto', backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Amount Due:</span>
                <span style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: '8px' }}>Br {parseFloat(order.total_price).toFixed(2)}</span>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Transaction ID / Reference No.</label>
                <input 
                  type="text" 
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="e.g. 7X9A234BC"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #3a3a4a', backgroundColor: '#181824', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Upload Payment Screenshot/Receipt</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #3a3a4a', backgroundColor: '#181824', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
              
              {receiptPreview && (
                <div style={{ marginTop: '8px', marginBottom: '12px', textAlign: 'center' }}>
                  <img src={receiptPreview} alt="Receipt Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px', border: '1px solid #3a3a4a' }} />
                </div>
              )}

              {paymentError && (
                <div className="field-error-msg show" style={{ marginBottom: '12px', color: 'var(--color-error)', fontSize: 12 }}>
                  <i className="fa-solid fa-circle-exclamation" /> {paymentError}
                </div>
              )}
            </div>
          )}

          <button
            className="btn-primary"
            disabled={isSubmittingPayment || (selectedPayment !== 'cash' && !txId.trim() && !receiptFile)}
            onClick={() => {
              if (selectedPayment === 'cash') {
                handleCashCheckout();
              } else {
                handleSubmitDigitalPayment();
              }
            }}
          >
            {isSubmittingPayment ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Submitting...</>
            ) : selectedPayment === 'cash' ? (
              <><i className="fa-solid fa-credit-card" /> Pay Bill (Br {parseFloat(order.total_price).toFixed(2)})</>
            ) : (
              <><i className="fa-solid fa-cloud-arrow-up" /> Submit Payment for Verification</>
            )}
          </button>
        </div>
      )}

      {/* Post-Payment Rating Prompt / Button (When Paid) */}
      {/* Post-Payment Rating Prompt / Button (When Paid) */}
      {isPaid && (
        <div className="paid-actions" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, margin: 0, backgroundColor: '#F59E0B', color: '#000', fontWeight: 700 }}
            onClick={onOpenRating}
          >
            <i className="fa-solid fa-star" /> {isRated ? 'Edit Rating & Feedback' : 'Rate Your Meal ⭐'}
          </button>
          
          <button
            className="btn-secondary"
            style={{ flex: 1, margin: 0, padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.1)' }}
            onClick={() => window.print()}
          >
            <i className="fa-solid fa-print" /> Print Receipt
          </button>

          {isRated && (
            <button
              className="btn-secondary"
              style={{ width: 'auto', padding: '10px 14px', margin: 0, backgroundColor: 'rgba(255,255,255,0.1)' }}
              onClick={onRemoveOrder}
              title="Clear finished order"
            >
              Done
            </button>
          )}
        </div>
      )}
      {/* Cancel Order Control */}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isCancelable ? (
          <button
            className="btn-secondary"
            onClick={handleCancelOrder}
            style={{
              margin: 0,
              padding: '6px 12px',
              fontSize: 12,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fa-solid fa-ban" /> Cancel Order
          </button>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            {isPaid ? '✅ Order Completed & Paid' : '🔒 Order accepted by kitchen — cancellation disabled'}
          </span>
        )}
      </div>
    </div>
  );
}

function TrackerSkeleton() {
  return (
    <div className="app-view">
      <div className="loading-skeleton" style={{ height: 36, marginBottom: 20, borderRadius: 8 }} />
      <div className="tracker-card">
        <div className="loading-skeleton" style={{ width: 70, height: 70, borderRadius: '50%', margin: '0 auto 20px' }} />
        <div className="loading-skeleton" style={{ height: 24, marginBottom: 8, borderRadius: 6 }} />
        <div className="loading-skeleton" style={{ height: 16, marginBottom: 20, borderRadius: 6, width: '60%', margin: '0 auto 20px' }} />
      </div>
    </div>
  );
}
