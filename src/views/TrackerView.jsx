import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOrderTracker } from '../hooks/useOrderTracker';

const STATUS_STEPS = ['pending', 'accepted', 'preparing', 'ready', 'completed'];

const STATUS_META = {
  pending:   { icon: 'fa-clock',          color: 'var(--color-warning)',  pulse: true  },
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

  const status = order?.status || 'pending';
  const isRejected = status === 'rejected';
  const meta = STATUS_META[status] || STATUS_META.pending;

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
        { label: t('status_pending'),  done: true  },
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
      </div>

      {/* Actions */}
      <button
        className="btn-primary"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
        onClick={handleNewOrder}
      >
        <i className="fa-solid fa-plus" /> {t('new_order')}
      </button>
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
