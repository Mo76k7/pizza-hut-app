import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { PAYMENT_ACCOUNTS } from '../utils/constants';
import RatingModal from '../components/RatingModal';
import PaymentModal from '../components/PaymentModal';

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
        .select('*, order_items(*)')
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

    const channel = supabase
      .channel('orders-realtime-tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bank_sms_logs' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

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
  const [paymentModal, setPaymentModal] = useState(false);

  const status = order?.status || 'received';
  const isRejected = status === 'rejected' || status === 'cancelled';
  const meta = STATUS_META[status] || STATUS_META.received;
  const isPaid = order.payment_status === 'paid';
  const isPendingVerification = order.payment_status === 'pending_verification';
  const isUnpaid = order.payment_status === 'unpaid';
  const isRated = localStorage.getItem(`rated_order_${order.id}`);
  const isCancelable = status === 'received';

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
            {t('order_number')}{order.order_number}
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
            VERIFYING ⏳
          </span>
        ) : (
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            UNPAID 💳
          </span>
        )}
      </div>

      {/* Pulse ring with status icon */}
      <div className="pulse-ring" style={{ borderColor: meta.color, background: `${meta.color}22` }}>
        <i className={`fa-solid ${meta.icon}`} style={{ fontSize: 26, color: meta.color }} />
      </div>

      {/* Order Status Title */}
      <h3 style={{ fontSize: 'clamp(17px,4vw,20px)', marginBottom: 4, color: '#FFF', textAlign: 'center' }}>
        {isRejected ? t('status_rejected') : t(`status_${status}`)}
      </h3>

      {!isRejected && status !== 'completed' && (
        <p style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 16, fontWeight: 600, textAlign: 'center' }}>
          ⏱ {t('est_time')}
        </p>
      )}

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

      {/* Payment Selection & Pay Button (When Unpaid) */}
      {isUnpaid && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
          <h4 style={{ color: '#fff', marginBottom: 10, fontSize: 14 }}>{t('payment_method')}</h4>

          <div className="payment-shortcuts" style={{ marginBottom: 12 }}>
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
                style={{ flex: '1 1 45%', padding: '8px', fontSize: 12 }}
              >
                <i className={`fa-solid ${icon}`} style={{ marginBottom: 2 }} />
                {label}
              </button>
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              if (selectedPayment === 'cash') {
                handleCashCheckout();
              } else {
                setPaymentModal(true);
              }
            }}
          >
            <i className="fa-solid fa-credit-card" /> Pay Bill (Br {parseFloat(order.total_price).toFixed(2)})
          </button>
        </div>
      )}

      {/* Post-Payment Rating Prompt / Button (When Paid) */}
      {isPaid && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, margin: 0, backgroundColor: '#F59E0B', color: '#000', fontWeight: 700 }}
            onClick={onOpenRating}
          >
            <i className="fa-solid fa-star" /> {isRated ? 'Edit Rating & Feedback' : 'Rate Your Meal ⭐'}
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

      {/* Payment Modal Component */}
      {paymentModal && (
        <PaymentModal
          order={order}
          paymentMethod={selectedPayment}
          onClose={() => setPaymentModal(false)}
          onSuccess={onRefresh}
        />
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
      </div>
    </div>
  );
}
