import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOrderTracker } from '../hooks/useOrderTracker';
import { supabase } from '../supabaseClient';
import { PAYMENT_ACCOUNTS } from '../utils/constants';

const STATUS_STEPS = ['received', 'accepted', 'preparing', 'ready', 'completed'];

const STATUS_META = {
  received:  { icon: 'fa-clock',          color: 'var(--color-warning)',  pulse: true  },
  accepted:  { icon: 'fa-thumbs-up',      color: 'var(--color-success)', pulse: true  },
  preparing: { icon: 'fa-fire-burner',    color: '#3B82F6',              pulse: true  },
  ready:     { icon: 'fa-bell',           color: 'var(--color-success)', pulse: false },
  completed: { icon: 'fa-circle-check',   color: 'var(--color-success)', pulse: false },
  rejected:  { icon: 'fa-circle-xmark',  color: 'var(--color-error)',   pulse: false },
};

export default function TrackerView({ onNavigate }) {
  const { activeOrderId, setActiveOrderId, t, clearCart } = useApp();
  const { order, loading, error } = useOrderTracker(activeOrderId);

  const [prevPaymentStatus, setPrevPaymentStatus] = useState(null);
  const [showVerifiedMsg, setShowVerifiedMsg] = useState(false);

  // Payment Modal States
  const [paymentModal, setPaymentModal] = useState(false);
  const [txnId, setTxnId] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('telebirr');

  useEffect(() => {
    if (order) {
      if (prevPaymentStatus === 'pending_verification' && order.payment_status === 'paid') {
        setShowVerifiedMsg(true);
        setTimeout(() => setShowVerifiedMsg(false), 3000);
      }
      setPrevPaymentStatus(order.payment_status);
    }
  }, [order, prevPaymentStatus]);

  const handleNewOrder = () => {
    setActiveOrderId(null);
    onNavigate('home');
  };

  const handlePaymentSubmit = async () => {
    // For Cash or Chapa (which isn't fully integrated here), we might bypass Txn ID check
    // but the prompt implies Telebirr/CBE are the main ones needing Txn ID.
    if (selectedPayment === 'cbe' || selectedPayment === 'telebirr') {
      if (!txnId.trim()) {
        setModalError('Transaction ID is required.');
        return;
      }
      if (selectedPayment === 'cbe' && !/^FT\w+/i.test(txnId.trim())) {
        setModalError('CBE Transaction ID must start with FT');
        return;
      }
      if (selectedPayment === 'telebirr' && !/^[A-Za-z0-9]+$/.test(txnId.trim())) {
        setModalError('Telebirr Transaction ID must be alphanumeric');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let receiptUrl = null;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `receipts/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);
          
        if (uploadError) throw new Error('Failed to upload receipt');

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        
        receiptUrl = publicUrl;
      }

      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          payment_method: selectedPayment,
          txn_id: txnId.trim(),
          payment_status: 'pending_verification',
          receipt_image_url: receiptUrl,
        })
        .eq('id', order.id);

      if (orderErr) throw orderErr;

      setPaymentModal(false);
    } catch (err) {
      console.error('[TrackerView] payment submit error:', err);
      setModalError(err.message || 'Error submitting payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeOrderId) {
    return (
      <div className="app-view" style={{ textAlign: 'center', paddingTop: 40 }}>
        <div className="empty-cart-icon">🍕</div>
        <h3 style={{ color: '#fff', marginBottom: 8 }}>No active order</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 13 }}>
          Place an order to track it here.
        </p>
        <button className="btn-primary" onClick={() => onNavigate('home')}>
          <i className="fa-solid fa-pizza-slice" /> {t('menu_nav')}
        </button>
      </div>
    );
  }

  if (loading) return <TrackerSkeleton />;

  if (error) return (
    <div className="app-view" style={{ textAlign: 'center', paddingTop: 40 }}>
      <p style={{ color: 'var(--color-error)' }}>Error: {error}</p>
      <button className="btn-secondary" onClick={handleNewOrder}>Back to Menu</button>
    </div>
  );

  const status = order?.status || 'received';
  const isRejected = status === 'rejected';
  const meta = STATUS_META[status] || STATUS_META.received;

  // Render pending payment state
  if (order?.payment_status === 'pending_verification') {
    return (
      <div className="app-view" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ marginBottom: 24 }}>
          <i className="fa-solid fa-building-columns fa-beat-fade" style={{ fontSize: 48, color: 'var(--color-accent)' }}></i>
        </div>
        <h2 style={{ color: '#fff', marginBottom: 12 }}>Verifying Payment</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, maxWidth: 280, margin: '0 auto 24px' }}>
          Please wait while we verify your transfer with the bank. This usually takes 1-2 minutes.
        </p>
        <div className="loading-skeleton" style={{ width: '60%', height: 6, borderRadius: 3, margin: '0 auto' }} />
      </div>
    );
  }

  // Render payment success state
  if (showVerifiedMsg) {
    return (
      <div className="app-view" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ marginBottom: 24 }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 64, color: 'var(--color-success)' }}></i>
        </div>
        <h2 style={{ color: 'var(--color-success)', marginBottom: 12 }}>Payment Verified!</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Your order has been sent to the kitchen.
        </p>
      </div>
    );
  }

  // Build timeline steps
  const timelineSteps = isRejected
    ? [
        { label: t('status_received'),  done: true  },
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
    <div className="app-view">
      <h1 className="display-title" style={{
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 'clamp(24px,5vw,32px)',
      }}>
        {t('order_status')}
      </h1>

      <div className="tracker-card">
        {/* Pulse ring with status icon */}
        <div
          className="pulse-ring"
          style={{ borderColor: meta.color, background: `${meta.color}22` }}
        >
          <i
            className={`fa-solid ${meta.icon}`}
            style={{ fontSize: 28, color: meta.color }}
          />
        </div>

        {/* Order info */}
        <h3 style={{ fontSize: 'clamp(18px,4vw,22px)', marginBottom: 5, color: '#FFF' }}>
          {isRejected ? t('status_rejected') : t(`status_${status}`)}
        </h3>

        {order && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>
            {t('order_number')}{order.order_number} · {t('table')} {order.table_number}
          </p>
        )}

        {!isRejected && status !== 'completed' && (
          <p style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 16, fontWeight: 600 }}>
            ⏱ {t('est_time')}
          </p>
        )}

        {/* Timeline */}
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

        {/* Order summary */}
        {order && (
          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--glass-border)',
            textAlign: 'left',
          }}>
            <div className="summary-row">
              <span>{t('subtotal')}</span>
              <span>Br {parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="summary-row tax-row">
              <span>VAT (15%)</span>
              <span>Br {parseFloat(order.vat).toFixed(2)}</span>
            </div>
            <div className="summary-row tax-row">
              <span>{t('service')}</span>
              <span>Br {parseFloat(order.service_fee).toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span>{t('total')}</span>
              <span>Br {parseFloat(order.total_price).toFixed(2)}</span>
            </div>
            {order.payment_method && (
              <div className="summary-row" style={{ marginTop: 4 }}>
                <span>Payment</span>
                <span style={{ textTransform: 'capitalize', color: 'var(--color-accent)' }}>
                  {order.payment_method}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment Selection & Action */}
        {order?.payment_status === 'unpaid' && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
            <h4 style={{ color: '#fff', marginBottom: 12 }}>{t('payment_method')}</h4>
            
            <div className="payment-shortcuts" style={{ marginBottom: 16 }}>
              {[
                { id: 'telebirr', label: 'Telebirr', icon: 'fa-mobile-screen' },
                { id: 'cbe',      label: 'CBE Birr', icon: 'fa-building-columns' },
                { id: 'chapa',    label: 'Chapa',    icon: 'fa-globe' },
                { id: 'cash',     label: t('cash'),  icon: 'fa-money-bill' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  className={`payment-btn ${selectedPayment === id ? 'selected' : ''}`}
                  onClick={() => setSelectedPayment(id)}
                  style={{ flex: '1 1 45%', padding: '10px 8px', fontSize: 12 }}
                >
                  <i className={`fa-solid ${icon}`} style={{ marginBottom: 4 }} />
                  {label}
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={async () => {
                if (selectedPayment === 'cash') {
                  // Instant update for cash
                  await supabase.from('orders').update({ payment_method: 'cash' }).eq('id', order.id);
                  // Optional: Show toast or just let them know
                  setPaymentModal(false);
                } else if (selectedPayment === 'chapa') {
                  // Instant update for chapa (placeholder)
                  await supabase.from('orders').update({ payment_method: 'chapa' }).eq('id', order.id);
                } else {
                  setPaymentModal(true);
                }
              }}
            >
              <i className="fa-solid fa-credit-card" /> Pay Bill / Checkout
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <button
        className="btn-secondary"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
        onClick={handleNewOrder}
      >
        <i className="fa-solid fa-plus" /> {t('new_order')}
      </button>

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            margin: 'auto', width: '90%', maxWidth: '400px',
            padding: '24px', borderRadius: '12px',
            backgroundColor: '#181824', opacity: 1, border: '1px solid #2d2d3f',
            zIndex: 100000,
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '20px', textAlign: 'center' }}>
              Pay with {selectedPayment === 'cbe' ? 'CBE Birr' : 'Telebirr'}
            </h3>
            
            <div style={{ textAlign: 'center', margin: '0 0 8px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: 4 }}>Total Amount</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-accent)', margin: 0 }}>
                Br {parseFloat(order.total_price).toFixed(2)}
              </p>
            </div>

            <div style={{ backgroundColor: '#0f0f17', padding: '16px', borderRadius: '8px', border: '1px solid #3f3f5a' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: 4, textTransform: 'uppercase' }}>
                Transfer to
              </p>
              <p style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#fff', fontWeight: 600 }}>
                {PAYMENT_ACCOUNTS[selectedPayment]?.number}
              </p>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>
                {PAYMENT_ACCOUNTS[selectedPayment]?.name}
              </p>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#fff' }}>
                Transaction Reference / Txn ID <span className="required-star">*</span>
              </label>
              <input 
                type="text" 
                placeholder={selectedPayment === 'cbe' ? "e.g. FT..." : "e.g. 7AG9B..."} 
                value={txnId} 
                onChange={(e) => {
                  setTxnId(e.target.value);
                  setModalError('');
                }}
                style={{ 
                  width: '100%', backgroundColor: '#0f0f17', color: '#ffffff', 
                  border: '1px solid #3f3f5a', padding: '12px', borderRadius: '8px', 
                  fontSize: '16px', outline: 'none', boxSizing: 'border-box'
                }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#fff' }}>
                Screenshot / Receipt (Optional)
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  setReceiptFile(e.target.files[0]);
                  setModalError('');
                }}
                style={{ 
                  width: '100%', color: '#ffffff', 
                  padding: '8px 0', fontSize: '14px'
                }} 
              />
            </div>
            
            {modalError && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{modalError}</div>}
            
            <button 
              className="btn-primary" 
              onClick={handlePaymentSubmit} 
              disabled={isSubmitting}
              style={{ margin: '8px 0 0', width: '100%', padding: '14px', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin" /> Verifying...</> : 'Submit Payment'}
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setPaymentModal(false);
                setModalError('');
              }} 
              disabled={isSubmitting}
              style={{ margin: 0, width: '100%', backgroundColor: 'transparent', border: 'none', padding: '10px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
        <div className="timeline">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="loading-skeleton timeline-step" style={{ height: 14, marginBottom: 20, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
