import React, { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { VAT_RATE, SERVICE_RATE, PAYMENT_ACCOUNTS } from '../utils/constants';

function generateOrderNumber() {
  return `ORD-${Date.now().toString().slice(-6)}`;
}

export default function CartView({ onNavigate }) {
  const {
    cart, updateQty, removeFromCart, clearCart,
    branch, cartSubtotal, cartCount,
    showToast, setActiveOrderId,
    t, getItemName, lang,
  } = useApp();

  const [tableNumber, setTableNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [splitCount, setSplitCount] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [tableError, setTableError] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vat = cartSubtotal * VAT_RATE;
  const service = cartSubtotal * SERVICE_RATE;
  const total = cartSubtotal + vat + service;
  const perPerson = splitCount > 1 ? (total / splitCount).toFixed(2) : null;

  const handlePaymentSelect = useCallback((method) => {
    setSelectedPayment(method);
    setPaymentError(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validation
    let valid = true;
    if (!tableNumber.trim()) { setTableError(true); valid = false; }
    if (!selectedPayment) { setPaymentError(true); valid = false; }
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const orderNumber = generateOrderNumber();

      // 1. Insert order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          branch_location: branch,
          table_number: tableNumber.trim(),
          status: 'pending',
          subtotal: parseFloat(cartSubtotal.toFixed(2)),
          vat: parseFloat(vat.toFixed(2)),
          service_fee: parseFloat(service.toFixed(2)),
          total_price: parseFloat(total.toFixed(2)),
          instructions: instructions.trim() || null,
          payment_method: selectedPayment,
          split_count: splitCount,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert order_items (price snapshot)
      const items = cart.map((ci) => ({
        order_id: order.id,
        menu_item_id: ci.menuItemId,
        item_name: ci.nameEn,
        selected_size: ci.size || null,
        selected_crust: ci.crust || null,
        quantity: ci.quantity,
        price_at_order: ci.unitPrice,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      // 3. Navigate to tracker
      setActiveOrderId(order.id);
      clearCart();
      showToast(`${t('order_placed')} #${orderNumber}`, 'var(--color-success)');
      onNavigate('tracker');
    } catch (err) {
      console.error('[CartView] submit error:', err);
      showToast('Error placing order. Please try again.', 'var(--color-error)');
    } finally {
      setIsSubmitting(false);
    }
  }, [tableNumber, selectedPayment, cart, branch, cartSubtotal, vat, service, total,
      instructions, splitCount, supabase, clearCart, showToast, setActiveOrderId, onNavigate, t]);

  // ── Empty state ──────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="app-view">
        <div className="tray-header-bar">
          <button className="btn-back-menu" onClick={() => onNavigate('home')}>
            <i className="fa-solid fa-arrow-left" /> {t('back')}
          </button>
          <h1 className="display-title" style={{ fontSize: 'clamp(16px,4vw,20px)' }}>
            {t('your_tray')}
          </h1>
          <div style={{ width: 60 }} />
        </div>

        <div className="empty-cart-state">
          <div className="empty-cart-icon">🛒</div>
          <h3 style={{ color: '#fff', marginBottom: 8 }}>{t('empty_tray')}</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 13 }}>
            Browse our delicious menu!
          </p>
          <button className="btn-browse-menu" onClick={() => onNavigate('home')}>
            <i className="fa-solid fa-pizza-slice" /> {t('browse_menu')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-view">
      {/* Header */}
      <div className="tray-header-bar">
        <button className="btn-back-menu" onClick={() => onNavigate('home')}>
          <i className="fa-solid fa-arrow-left" /> {t('back')}
        </button>
        <h1 className="display-title" style={{ fontSize: 'clamp(16px,4vw,20px)' }}>
          {t('your_tray')}
        </h1>
        <button
          className="btn-clear-cart"
          id="btn-clear-cart"
          onClick={clearCart}
          style={{ display: 'flex' }}
        >
          <i className="fa-solid fa-trash" /> {t('clear')}
        </button>
      </div>

      {/* Cart items */}
      <div id="cart-items-root">
        {cart.map((item) => (
          <CartItem
            key={item.cartId}
            item={item}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            lang={lang}
          />
        ))}
      </div>

      {/* Form section */}
      <div id="cart-form-section">
        {/* Table number */}
        <div className="table-selector-card">
          <div className="table-selector-label">
            <i className="fa-solid fa-chair" /> {t('table_number')} <span className="required-star">*</span>
          </div>
          <input
            type="text"
            id="table-number-input"
            className={`table-input-field ${tableError ? 'error' : ''}`}
            placeholder="e.g. 04"
            value={tableNumber}
            onChange={(e) => { setTableNumber(e.target.value); setTableError(false); }}
          />
        </div>
        {tableError && <div className="field-error-msg show">{t('error_table')}</div>}

        {/* Split bill */}
        <div className="split-bill-toggle">
          <i className="fa-solid fa-users" /> {t('split_among')}
          <input
            type="number"
            className="split-count"
            id="split-count"
            min="1"
            max="20"
            value={splitCount}
            onChange={(e) => setSplitCount(Math.max(1, parseInt(e.target.value) || 1))}
          />
          {t('people')}
          {perPerson && (
            <span style={{
              color: 'var(--color-accent)',
              fontWeight: 700,
              fontSize: 'clamp(10px,2.2vw,11px)',
              marginLeft: 'auto',
            }}>
              Br {perPerson} / {t('per_person')}
            </span>
          )}
        </div>

        {/* Instructions */}
        <div className="instructions-card">
          <div className="instructions-label">
            <i className="fa-solid fa-pen-to-square" /> {t('extra_instructions')}
          </div>
          <textarea
            id="extra-instructions-input"
            className="instructions-textarea"
            placeholder={t('instructions_placeholder')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        {/* Summary */}
        <div className="summary-block">
          <div className="summary-row">
            <span>{t('subtotal')}</span>
            <span id="summary-subtotal">Br {cartSubtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row tax-row">
            <span>VAT (15%)</span>
            <span id="summary-vat">Br {vat.toFixed(2)}</span>
          </div>
          <div className="summary-row tax-row">
            <span>{t('service')}</span>
            <span id="summary-service">Br {service.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>{t('total')}</span>
            <span id="summary-total">Br {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="payment-card">
          <div className="payment-section-title">
            <i className="fa-solid fa-credit-card" /> {t('payment_method')} <span className="required-star">*</span>
          </div>
          {paymentError && <div className="field-error-msg show">{t('error_payment')}</div>}
          <div className="payment-shortcuts">
            {[
              { id: 'telebirr', label: 'Telebirr', icon: 'fa-mobile-screen',    sub: '0905909090' },
              { id: 'cbe',      label: 'CBE Birr', icon: 'fa-building-columns', sub: '0987878787' },
              { id: 'chapa',    label: 'Chapa',    icon: 'fa-globe',             sub: '0989' },
              { id: 'cash',     label: t('cash'),  icon: 'fa-money-bill',        sub: t('waiter') },
            ].map(({ id, label, icon, sub }) => (
              <button
                key={id}
                className={`payment-btn ${selectedPayment === id ? 'selected' : ''}`}
                onClick={() => handlePaymentSelect(id)}
                id={`pay-${id}`}
              >
                <i className={`fa-solid ${icon}`} />
                {label}
                <span style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>{sub}</span>
              </button>
            ))}
          </div>

          {/* Account display */}
          {selectedPayment && selectedPayment !== 'cash' && (
            <div className="payment-account-display show">
              <div style={{ fontSize: 'clamp(9px,2vw,11px)', color: 'var(--color-text-muted)' }}>
                {t('pay_to')}
              </div>
              <div className="account-number" id="display-account-number">
                {PAYMENT_ACCOUNTS[selectedPayment]?.number}
              </div>
              <div id="display-account-name" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {PAYMENT_ACCOUNTS[selectedPayment]?.name}
              </div>
              <button
                className="copy-account-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(PAYMENT_ACCOUNTS[selectedPayment]?.number);
                  showToast('Account number copied!');
                }}
              >
                <i className="fa-solid fa-copy" /> {t('copy_number')}
              </button>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          className="btn-primary"
          id="checkout-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting
            ? <><i className="fa-solid fa-spinner fa-spin" /> {t('processing')}</>
            : <><i className="fa-solid fa-paper-plane" /> {t('send_order')}</>
          }
        </button>
      </div>

      <div className="kitchen-info-note">
        Kitchen: @MO76k7 (0923845344)
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// CartItem sub-component
// ──────────────────────────────────────────────
function CartItem({ item, onUpdateQty, onRemove, lang }) {
  const displayName = lang === 'am' ? (item.nameAm || item.nameEn) : item.nameEn;
  const lineTotal = (item.unitPrice * item.quantity).toFixed(2);
  const sizeLabel = item.size ? item.size.charAt(0).toUpperCase() + item.size.slice(1) : null;

  return (
    <div className="cart-item">
      <div className="cart-item-img-wrapper">
        <img
          src={item.imageUrl || '/pizza-placeholder.jpg'}
          alt={displayName}
          onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
        />
        {sizeLabel && (
          <div className="cart-item-size-badge">{sizeLabel[0]}</div>
        )}
      </div>

      <div className="cart-item-info">
        <div className="cart-item-title">
          {displayName}
          {item.crust && item.crust !== 'regular' && (
            <span className="cart-item-crust-tag">{item.crust}</span>
          )}
        </div>
        <div className="cart-item-meta">
          {sizeLabel && `${sizeLabel} • `}
          Br {item.unitPrice.toFixed(2)} each
        </div>
        <div className="cart-item-price">Br {lineTotal}</div>
      </div>

      <div className="qty-selector">
        <button
          className="qty-btn"
          onClick={() => onUpdateQty(item.cartId, -1)}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="qty-value">{item.quantity}</span>
        <button
          className="qty-btn"
          onClick={() => onUpdateQty(item.cartId, 1)}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <button
        className="remove-btn"
        onClick={() => onRemove(item.cartId)}
        aria-label={`Remove ${displayName}`}
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  );
}
