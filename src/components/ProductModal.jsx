import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../context/AppContext';
import { STUFFED_CRUST_PRICE_MEDIUM, STUFFED_CRUST_PRICE_LARGE } from '../utils/constants';

const SIZES = ['small', 'medium', 'large'];
const CRUSTS = [
  { id: 'regular', label: 'Regular' },
  { id: 'thin', label: 'Thin' },
  { id: 'thick', label: 'Thick' },
  { id: 'stuffed', label: 'Stuffed (+Br 795)' },
];

function calcPrice(item, size, crust) {
  if (!item) return 0;
  const prices = item.prices_json || {};

  if (item.item_type === 'pizza') {
    if (crust === 'stuffed') {
      return size === 'large' ? STUFFED_CRUST_PRICE_LARGE : STUFFED_CRUST_PRICE_MEDIUM;
    }
  }

  if (prices && typeof prices === 'object' && Object.keys(prices).length > 0) {
    if (prices[size] !== undefined && prices[size] !== null && !isNaN(prices[size])) {
      return Number(prices[size]);
    }
  }

  return Number(item.base_price || item.price || 0);
}

export default function ProductModal({ item, onClose }) {
  const { addToCart, showToast, getItemName, getItemDesc, t } = useApp();
  const [size, setSize] = useState('medium');
  const [crust, setCrust] = useState('regular');
  const [qty, setQty] = useState(1);

  // Reset on new item
  useEffect(() => {
    setSize('medium');
    setCrust('regular');
    setQty(1);
  }, [item?.id]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const unitPrice = calcPrice(item, size, crust);
  const totalPrice = unitPrice * qty;
  const isPizza = item?.item_type === 'pizza';
  const hasSizes = !!item?.prices_json && typeof item.prices_json === 'object' && Object.keys(item.prices_json).length > 0;

  const handleAddToCart = () => {
    if (!item) return;
    const cartId = hasSizes
      ? `${item.id}-${size}-${isPizza ? crust : 'no-crust'}`
      : `${item.id}-flat-${Date.now()}`;

    addToCart({
      cartId,
      menuItemId: item.id,
      name: getItemName ? getItemName(item) : item.name,
      nameEn: item.name,
      nameAm: item.name_am || item.name,
      size: hasSizes ? size : null,
      crust: isPizza ? crust : null,
      unitPrice,
      quantity: qty,
      imageUrl: item.image_url || null,
      itemType: item.item_type,
    });

    const itemNameStr = getItemName ? getItemName(item) : item.name;
    showToast(`${itemNameStr} added to tray!`, 'var(--color-success)');
    if (onClose) onClose();
  };

  const itemName = getItemName ? getItemName(item) : (item.name || 'Menu Item');
  const itemDesc = getItemDesc ? getItemDesc(item) : (item.description || '');

  const modalContent = (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={itemName}
    >
      <div
        className="modal-sheet product-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          backgroundColor: '#161622',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          padding: '20px',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          color: '#ffffff',
          position: 'relative',
          animation: 'none',
          transform: 'none',
        }}
      >
        {/* Header with Title and Prominent X Close Button */}
        <div className="modal-close-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3
            className="display-title"
            id="modal-item-name"
            style={{ fontSize: 'clamp(18px, 4vw, 22px)', margin: 0, color: '#ffffff', fontWeight: 700 }}
          >
            {itemName}
          </h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Image */}
        <div className="modal-img-container" style={{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14, backgroundColor: '#0f0f17' }}>
          <img
            id="modal-item-img"
            src={item.image_url || '/pizza-placeholder.jpg'}
            alt={itemName}
            className="modal-img"
            onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
            style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Description */}
        {itemDesc ? (
          <p id="modal-item-desc" className="modal-desc" style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
            {itemDesc}
          </p>
        ) : null}

        {/* Crust options (Pizza only) */}
        {isPizza && (
          <div id="crust-options-container" style={{ marginBottom: 14 }}>
            <div className="options-group-title" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t ? t('crust_type') : 'Crust Type'}
            </div>
            <div className="crust-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {CRUSTS.map(({ id: crustId, label }) => (
                <div
                  key={crustId}
                  className={`crust-btn ${crust === crustId ? 'active' : ''}`}
                  id={`crust-${crustId}`}
                  onClick={() => setCrust(crustId)}
                  role="button"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 13,
                    cursor: 'pointer',
                    backgroundColor: crust === crustId ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                    color: crust === crustId ? '#ffffff' : 'rgba(255,255,255,0.8)',
                    border: crust === crustId ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Size options (Any item with sizes) */}
        {hasSizes && (
          <div id="size-options-container" style={{ marginBottom: 14 }}>
            <div className="options-group-title" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t ? t('select_size') : 'Select Size'}
            </div>
            <div className="selector-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {SIZES.map((s) => {
                const p = item.prices_json?.[s] || item.base_price || item.price || 0;
                return (
                  <div
                    key={s}
                    className={`selector-btn ${size === s ? 'active' : ''}`}
                    id={`size-${s}`}
                    onClick={() => setSize(s)}
                    role="button"
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      textAlign: 'center',
                      fontSize: 13,
                      cursor: 'pointer',
                      backgroundColor: size === s ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                      color: size === s ? '#ffffff' : 'rgba(255,255,255,0.8)',
                      border: size === s ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s.charAt(0).toUpperCase() + s.slice(1)}</div>
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Br {p}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity + Add button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '14px',
          gap: '12px',
        }}>
          <div className="qty-selector" style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '4px 8px' }}>
            <button
              className="qty-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', width: 28, height: 28 }}
            >
              −
            </button>
            <span className="qty-value" id="modal-qty-display" style={{ fontSize: 15, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
              {qty}
            </span>
            <button
              className="qty-btn"
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              aria-label="Increase quantity"
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', width: 28, height: 28 }}
            >
              +
            </button>
          </div>

          <button
            className="btn-primary"
            style={{
              margin: 0,
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.4)',
            }}
            onClick={handleAddToCart}
            id="modal-add-btn"
          >
            {t ? t('add_to_tray') : 'Add to Tray'} — Br {totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
