import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';
import { VAT_RATE, SERVICE_RATE, PAYMENT_ACCOUNTS } from '../utils/constants';

export default function CartView({ onNavigate }) {
  const {
    cart, updateQty, removeFromCart, clearCart,
    branch, cartSubtotal, cartCount,
    showToast, setActiveOrderId,
    t, lang,
  } = useApp();

  const [tableNumber, setTableNumber] = useState('');
  const [tableError, setTableError] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1 = Summary, 2 = Success
  const [finalOrderNo, setFinalOrderNo] = useState('');

  const vat = cartSubtotal * VAT_RATE;
  const service = cartSubtotal * SERVICE_RATE;
  const total = cartSubtotal + vat + service;

  const handleSubmit = async () => {
    let valid = true;
    if (!tableNumber.trim()) { setTableError(true); valid = false; }
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const { data: latestOrder, error: latestOrderErr } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (!latestOrderErr && latestOrder && latestOrder.length > 0) {
        const lastNumberStr = latestOrder[0].order_number;
        const lastNumber = parseInt(lastNumberStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      const orderNumber = `Order #${nextNumber}`;

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          branch_location: branch,
          table_number: tableNumber.trim(),
          status: 'received',
          subtotal: parseFloat(cartSubtotal.toFixed(2)),
          vat: parseFloat(vat.toFixed(2)),
          service_fee: parseFloat(service.toFixed(2)),
          total_price: parseFloat(total.toFixed(2)),
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash' ? 'pending' : 'pending_verification',
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Insert order_items
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

      // Success
      setActiveOrderId(order.id);
      setFinalOrderNo(orderNumber);
      setStep(2); // Move to success step
      clearCart();
    } catch (err) {
      console.error('[CartView] submit error:', err);
      showToast(err.message || 'Error placing order. Please try again.', 'bg-red-500');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Empty state ──────────────────────────────────
  if (cart.length === 0 && step === 1) {
    return (
      <div className="w-full h-full flex flex-col p-5 pb-32 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <button 
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => onNavigate('home')}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <h1 className="text-xl font-bold text-white">Checkout</h1>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            <i className="fa-solid fa-basket-shopping text-4xl text-gray-400"></i>
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Tray is Empty</h3>
          <p className="text-gray-400 text-sm mb-8 text-center max-w-[200px]">Browse our delicious menu and add some items to your tray!</p>
          <button 
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-full shadow-[0_4px_20px_rgba(249,115,22,0.4)] transition-transform hover:scale-105"
            onClick={() => onNavigate('home')}
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Success State (Step 2) ────────────────────────
  if (step === 2) {
    const isCash = paymentMethod === 'cash';
    const accountInfo = PAYMENT_ACCOUNTS[paymentMethod] || PAYMENT_ACCOUNTS.telebirr;

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-5 z-10 relative">
        <div className="glass-panel w-full max-w-sm rounded-[32px] p-8 flex flex-col items-center text-center">
          
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
            <i className="fa-solid fa-check text-4xl text-green-400"></i>
          </div>
          
          <h2 className="text-2xl font-black text-white mb-2">Order Received!</h2>
          <p className="text-gray-400 text-sm mb-6">{finalOrderNo} has been sent to the kitchen.</p>

          {!isCash ? (
            <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-gray-300 text-sm mb-3">Please transfer exactly <strong className="text-orange-400">Br {total.toFixed(2)}</strong> to:</p>
              <div className="text-xl font-bold text-white tracking-wider font-mono mb-1">{accountInfo.number}</div>
              <div className="text-gray-400 text-xs uppercase tracking-widest">{accountInfo.name}</div>
              <p className="text-[11px] text-gray-500 mt-4 leading-relaxed border-t border-white/10 pt-3">
                We will verify your payment when your food arrives. No receipt upload required!
              </p>
            </div>
          ) : (
            <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 mb-6">
               <p className="text-gray-300 text-sm">Please prepare <strong className="text-orange-400">Br {total.toFixed(2)}</strong> in cash for when your food arrives.</p>
            </div>
          )}

          <button 
            className="w-full bg-gradient-to-r from-orange-500 to-orange-400 text-white font-bold py-4 rounded-full shadow-[0_8px_25px_rgba(249,115,22,0.4)] transition-transform hover:scale-[1.02]"
            onClick={() => onNavigate('tracker')}
          >
            Track Order Status
          </button>
        </div>
      </div>
    );
  }

  // ── Checkout Form (Step 1) ────────────────────────
  return (
    <div className="w-full flex-1 overflow-y-auto hide-scrollbar px-5 pb-32 pt-2 z-10 relative">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button 
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={() => onNavigate('home')}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <h1 className="text-xl font-bold text-white">Order Summary</h1>
        <button 
          onClick={clearCart}
          className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
        >
          <i className="fa-solid fa-trash-can text-sm"></i>
        </button>
      </div>

      {/* Itemized List */}
      <div className="glass-panel rounded-[28px] p-4 mb-6">
        {cart.map((item) => (
          <CartItem key={item.cartId} item={item} onUpdateQty={updateQty} onRemove={removeFromCart} lang={lang} />
        ))}

        {/* Cost Summary */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
          <div className="flex justify-between text-gray-400 text-sm">
            <span>Subtotal</span>
            <span>Br {cartSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-400 text-sm">
            <span>Tax & Fees</span>
            <span>Br {(vat + service).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white font-bold text-lg mt-2 pt-2 border-t border-white/10">
            <span>Total</span>
            <span className="text-orange-400">Br {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table Number */}
      <div className="mb-6">
        <h3 className="text-white font-bold mb-3 px-1">Table Number</h3>
        <input
          type="text"
          className={`w-full glass-input rounded-2xl py-4 px-5 text-lg font-bold text-center ${tableError ? 'border-red-500 ring-1 ring-red-500 bg-red-500/10' : ''}`}
          placeholder="e.g. 04"
          value={tableNumber}
          onChange={(e) => { setTableNumber(e.target.value); setTableError(false); }}
        />
        {tableError && <p className="text-red-400 text-xs text-center mt-2 font-medium">Please enter your table number</p>}
      </div>

      {/* Payment Method Selection */}
      <div className="mb-8">
        <h3 className="text-white font-bold mb-3 px-1">Payment Method</h3>
        <div className="flex flex-col gap-3">
          {[
            { id: 'telebirr', name: 'Telebirr', icon: 'fa-mobile-screen' },
            { id: 'cbe', name: 'CBE Birr', icon: 'fa-building-columns' },
            { id: 'cash', name: 'Cash', icon: 'fa-money-bill-wave' }
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setPaymentMethod(method.id)}
              className={`flex items-center gap-4 w-full p-4 rounded-2xl border transition-all ${
                paymentMethod === method.id 
                  ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' 
                  : 'glass-card border-transparent hover:border-white/20'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === method.id ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                <i className={`fa-solid ${method.icon}`}></i>
              </div>
              <span className={`font-bold text-[15px] ${paymentMethod === method.id ? 'text-white' : 'text-gray-300'}`}>
                {method.name}
              </span>
              {paymentMethod === method.id && (
                <i className="fa-solid fa-circle-check text-orange-500 ml-auto text-xl"></i>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-[60px] bg-gradient-to-r from-orange-500 to-orange-400 rounded-full flex items-center justify-between px-6 shadow-[0_8px_25px_rgba(249,115,22,0.4)] transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
      >
        <span className="text-white font-bold text-[16px]">
          {isSubmitting ? 'Processing...' : 'Confirm Order'}
        </span>
        {!isSubmitting && (
          <span className="text-orange-100 font-bold text-[16px] pl-4 border-l border-white/20">Br {total.toFixed(2)}</span>
        )}
      </button>

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
    <div className="flex gap-3 py-3 border-b border-white/5 last:border-0 relative group">
      
      {/* Image */}
      <div className="w-[60px] h-[60px] rounded-[16px] bg-black/40 overflow-hidden relative shrink-0">
        <img
          src={item.imageUrl || '/pizza-placeholder.jpg'}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
        />
        {sizeLabel && (
          <div className="absolute top-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-[8px]">
            {sizeLabel[0]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 justify-center">
        <div className="text-white font-bold text-[13px] leading-tight mb-1 pr-6">
          {displayName} {item.crust && item.crust !== 'regular' && <span className="text-[10px] text-orange-400 font-normal ml-1 border border-orange-500/50 rounded-md px-1">{item.crust}</span>}
        </div>
        <div className="text-orange-400 font-bold text-[13px]">
          Br {lineTotal} <span className="text-gray-500 text-[10px] font-normal ml-1">(@ Br {item.unitPrice.toFixed(2)})</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-end justify-between">
        <button 
          onClick={() => onRemove(item.cartId)}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
        
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
          <button onClick={() => onUpdateQty(item.cartId, -1)} className="w-5 h-5 flex items-center justify-center text-white text-xs hover:bg-white/10 rounded-full">
            <i className="fa-solid fa-minus"></i>
          </button>
          <span className="text-white text-xs font-bold w-3 text-center">{item.quantity}</span>
          <button onClick={() => onUpdateQty(item.cartId, 1)} className="w-5 h-5 flex items-center justify-center text-white text-xs hover:bg-white/10 rounded-full">
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>

    </div>
  );
}
