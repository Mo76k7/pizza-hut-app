import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../context/AppContext';
import { STUFFED_CRUST_PRICE_MEDIUM, STUFFED_CRUST_PRICE_LARGE } from '../utils/constants';

import { triggerFlyToCartAnimation } from '../utils/animations';

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

  const handleAddToCart = (e) => {
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

    triggerFlyToCartAnimation(e, item.image_url);

    const itemNameStr = getItemName ? getItemName(item) : item.name;
    showToast(`${itemNameStr} added to tray!`, 'var(--color-success)');
    if (onClose) onClose();
  };

  const itemName = getItemName ? getItemName(item) : (item.name || 'Menu Item');
  const itemDesc = getItemDesc ? getItemDesc(item) : (item.description || '');

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-[440px] max-h-[90vh] bg-black/40 backdrop-blur-2xl sm:rounded-[32px] rounded-t-[32px] overflow-hidden shadow-2xl border-t border-white/10 sm:border relative flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top actions overlay on image */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-red-500 flex items-center justify-center hover:bg-black/50 transition-colors">
             <i className="fa-solid fa-heart"></i>
          </button>
        </div>

        {/* Hero Image */}
        <div className="w-full h-64 sm:h-72 relative shrink-0">
          <img
            src={item.image_url || '/pizza-placeholder.jpg'}
            alt={itemName}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 hide-scrollbar">
          
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Spicy</span>
            <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">Popular</span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 leading-tight">
            {itemName}
          </h3>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-star text-orange-400 text-sm"></i>
              <span className="text-white font-bold text-sm">4.8</span>
              <span className="text-gray-400 text-xs">(120)</span>
            </div>
            <span className="text-orange-500 font-bold text-lg">Br {calcPrice(item, size, crust)}</span>
          </div>

          {itemDesc && (
            <p className="text-gray-400 text-[13px] leading-relaxed mb-6">
              {itemDesc}
            </p>
          )}

          {/* Customization Section */}
          <div className="border-t border-white/10 pt-4 mb-2">
            <h4 className="text-white font-bold text-[15px] mb-4">Customize</h4>

            {hasSizes && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-300 text-[13px]">Size</span>
                <div className="flex gap-2 bg-white/5 p-1 rounded-full border border-white/5">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                        size === s ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isPizza && (
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-[13px]">Crust Type</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CRUSTS.map(({ id: crustId, label }) => (
                    <button
                      key={crustId}
                      onClick={() => setCrust(crustId)}
                      className={`py-2 rounded-xl text-[12px] font-bold transition-all border ${
                        crust === crustId 
                          ? 'bg-orange-500/20 border-orange-500 text-orange-400' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="p-4 sm:p-6 pt-2 shrink-0 bg-black/20 backdrop-blur-md border-t border-white/5">
          <div className="flex items-center gap-4">
            
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1 h-[52px]">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full text-white text-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                −
              </button>
              <span className="text-white font-bold text-lg min-w-[20px] text-center">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(10, q + 1))}
                className="w-10 h-10 rounded-full text-white text-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 h-[52px] bg-gradient-to-r from-orange-500 to-orange-400 rounded-full flex items-center justify-between px-6 shadow-[0_8px_20px_rgba(249,115,22,0.4)] transition-transform hover:scale-[1.02]"
            >
              <span className="text-white font-bold text-[15px]">Add to Cart</span>
              <span className="text-orange-100 font-bold text-[15px] pl-4 border-l border-white/20">Br {totalPrice.toFixed(2)}</span>
            </button>
            
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
