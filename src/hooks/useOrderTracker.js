import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Subscribes to a single order's realtime updates.
 * @param {string|null} orderId
 * @returns {{ order, loading, error }}
 */
export function useOrderTracker(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const fetchOrder = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single();
      if (err) throw err;
      setOrder(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder(orderId);

    // Subscribe to realtime changes on this specific order
    const channel = supabase
      .channel(`order-tracker-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [orderId, fetchOrder]);

  return { order, loading, error };
}
