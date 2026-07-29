import React, { createContext, useContext, useState, useCallback } from 'react';
import { TRANSLATIONS } from '../utils/constants';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [branch, setBranch] = useState('4 Kilo');
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [activeOrderIds, setActiveOrderIdsState] = useState(() => {
    try {
      const saved = localStorage.getItem('activeOrderIds');
      if (saved) return JSON.parse(saved);
      const single = localStorage.getItem('activeOrderId');
      return single ? [single] : [];
    } catch {
      return [];
    }
  });

  const addActiveOrderId = useCallback((id) => {
    if (!id) return;
    setActiveOrderIdsState((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('activeOrderIds', JSON.stringify(updated));
      localStorage.setItem('activeOrderId', id);
      return updated;
    });
  }, []);

  const removeActiveOrderId = useCallback((id) => {
    if (!id) return;
    setActiveOrderIdsState((prev) => {
      const updated = prev.filter((oId) => oId !== id);
      localStorage.setItem('activeOrderIds', JSON.stringify(updated));
      if (updated.length > 0) {
        localStorage.setItem('activeOrderId', updated[updated.length - 1]);
      } else {
        localStorage.removeItem('activeOrderId');
      }
      return updated;
    });
  }, []);

  const setActiveOrderId = useCallback((id) => {
    if (id) {
      addActiveOrderId(id);
    } else {
      setActiveOrderIdsState([]);
      localStorage.removeItem('activeOrderIds');
      localStorage.removeItem('activeOrderId');
    }
  }, [addActiveOrderId]);

  const activeOrderId = activeOrderIds.length > 0 ? activeOrderIds[activeOrderIds.length - 1] : null;
  // Translation helper
  const t = useCallback((key) => TRANSLATIONS[lang]?.[key] ?? key, [lang]);

  // Get item name/desc in current language
  const getItemName = useCallback((item) =>
    lang === 'am' ? (item.name_am || item.name) : item.name, [lang]);
  const getItemDesc = useCallback((item) =>
    lang === 'am' ? (item.description_am || item.description || '') : (item.description || ''), [lang]);
  const getCatName = useCallback((cat) =>
    lang === 'am' ? (cat.name_am || cat.name) : cat.name, [lang]);

  // Toast
  const showToast = useCallback((msg, color = 'var(--color-primary)') => {
    setToast({ msg, color, id: Date.now() });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Cart actions
  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.cartId === item.cartId);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const updateQty = useCallback((cartId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((cartId) => {
    setCart((prev) => prev.filter((c) => c.cartId !== cartId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <AppContext.Provider value={{
      lang, setLang,
      branch, setBranch,
      cart, addToCart, updateQty, removeFromCart, clearCart,
      cartCount, cartSubtotal,
      toast, showToast,
      activeOrderId, setActiveOrderId,
      activeOrderIds, addActiveOrderId, removeActiveOrderId,
      t, getItemName, getItemDesc, getCatName,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
