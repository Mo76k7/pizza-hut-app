import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { STUFFED_CRUST_PRICE_MEDIUM, STUFFED_CRUST_PRICE_LARGE } from '../utils/constants';

const SIZES = ['small', 'medium', 'large'];
const CRUSTS = [
  { id: 'regular', label: 'Regular' },
  { id: 'thin',    label: 'Thin' },
  { id: 'thick',   label: 'Thick' },
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

  if (Object.keys(prices).length > 0) {
    return prices[size] || item.base_price || item.price || 0;
  }
  
  return item.base_price || item.price || 0;
}

export default function ProductModal({ item, onClose }) {
  const { addToCart, showToast, lang, getItemName, getItemDesc, t, cartCount } = useApp();
  const [size, setSize] = useState('medium');
  const [crust, setCrust] = useState('regular');
  const [qty, setQty] = useState(1);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);

  // Reset on new item
  useEffect(() => {
    setSize('medium');
    setCrust('regular');
    setQty(1);
  }, [item?.id]);

  const unitPrice = calcPrice(item, size, crust);
  const totalPrice = unitPrice * qty;
  const isPizza = item?.item_type === 'pizza';
  const hasSizes = !!item?.prices_json && Object.keys(item.prices_json).length > 0;

  const handleAddToCart = useCallback(() => {
    if (!item) return;
    const cartId = hasSizes
      ? `${item.id}-${size}-${isPizza ? crust : 'no-crust'}`
      : `${item.id}-flat-${Date.now()}`;

    addToCart({
      cartId,
      menuItemId: item.id,
      name: getItemName(item),
      nameEn: item.name,
      nameAm: item.name_am || item.name,
      size: hasSizes ? size : null,
      crust: isPizza ? crust : null,
      unitPrice,
      quantity: qty,
      imageUrl: item.image_url || null,
      itemType: item.item_type,
    });

    // Flying item animation — trigger from modal image
    const imgEl = document.getElementById('modal-item-img');
    if (imgEl && item.image_url) {
      flyToCart(imgEl, item.image_url);
    }

    showToast(`${getItemName(item)} added to tray!`);
    onClose();
  }, [item, size, crust, qty, unitPrice, addToCart, showToast, getItemName, onClose, isPizza]);

  // Touch drag-to-dismiss
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const handleTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };
  const handleTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientY - (dragStartY.current || 0);
    dragStartY.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s ease-out';
      if (delta > 100) { onClose(); }
      else { sheetRef.current.style.transform = 'translateY(0)'; }
    }
  };

  if (!item) return null;

  const sizeClass = hasSizes ? `size-${size}` : 'size-medium';

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={getItemName(item)}
    >
      <div
        className="modal-sheet"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="modal-drag-handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Header */}
        <div className="modal-close-header">
          <h3
            className="display-title"
            id="modal-item-name"
            style={{ fontSize: 'clamp(16px,4vw,20px)' }}
          >
            {getItemName(item)}
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Image */}
        <div className="modal-img-container">
          <img
            id="modal-item-img"
            src={item.image_url || '/pizza-placeholder.jpg'}
            alt={getItemName(item)}
            className={`modal-img ${sizeClass}`}
            onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
          />
        </div>

        {/* Description */}
        <p id="modal-item-desc" className="modal-desc">
          {getItemDesc(item)}
        </p>

        {/* Crust options (Pizza only) */}
        {isPizza && (
          <div id="crust-options-container">
            <div className="options-group-title">{t('crust_type')}</div>
            <div className="crust-options">
              {CRUSTS.map(({ id: crustId, label }) => (
                <div
                  key={crustId}
                  className={`crust-btn ${crust === crustId ? 'active' : ''}`}
                  id={`crust-${crustId}`}
                  onClick={() => setCrust(crustId)}
                  role="button"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Size options (Any item with sizes) */}
        {hasSizes && (
          <div id="size-options-container">
            <div className="options-group-title">{t('select_size')}</div>
            <div className="selector-row">
              {SIZES.map((s) => {
                const p = item.prices_json?.[s] || item.base_price || item.price || 0;
                return (
                  <div
                    key={s}
                    className={`selector-btn ${size === s ? 'active' : ''}`}
                    id={`size-${s}`}
                    onClick={() => setSize(s)}
                    role="button"
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}<br />Br {p}
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
          marginTop: '14px',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '12px',
          gap: '10px',
        }}>
          <div className="qty-selector">
            <button
              className="qty-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="qty-value" id="modal-qty-display">{qty}</span>
            <button
              className="qty-btn"
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            className="btn-primary"
            style={{ margin: 0, flex: 1 }}
            onClick={handleAddToCart}
            id="modal-add-btn"
          >
            {t('add_to_tray')} — Br{' '}
            <span id="modal-total-price-display">{totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Flying-item animation utility
function flyToCart(imgEl, imgSrc) {
  const rect = imgEl.getBoundingClientRect();
  const tray = document.getElementById('floating-tray-btn');
  if (!tray) return;
  const trayRect = tray.getBoundingClientRect();

  const fly = document.createElement('img');
  fly.src = imgSrc;
  fly.className = 'flying-item';
  fly.style.left = `${rect.left + rect.width / 2 - 22}px`;
  fly.style.top = `${rect.top + rect.height / 2 - 22}px`;
  fly.style.position = 'fixed';
  document.body.appendChild(fly);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fly.style.left = `${trayRect.left + trayRect.width / 2 - 22}px`;
      fly.style.top = `${trayRect.top + trayRect.height / 2 - 22}px`;
      fly.style.transform = 'scale(0.2)';
      fly.style.opacity = '0.3';
    });
  });

  setTimeout(() => fly.remove(), 550);
}
