import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export function useKitchenOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { branch, showToast } = useApp();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch orders for this branch that are not completed or rejected
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('branch_location', branch)
        .neq('status', 'completed')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setOrders(data || []);
    } catch (e) {
      setError(e.message);
      console.error('[useKitchenOrders] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to any changes on the orders table for this branch
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `branch_location=eq.${branch}` },
        (payload) => {
          // Play sound here in the future if needed
          showToast(`New Order #${payload.new.order_number}!`, 'var(--color-success)');
          
          // We need to fetch the order items for the new order, so we fetch it specifically
          // Or just trigger a full refetch for simplicity since it's a dashboard.
          // Full refetch ensures we get the joined order_items accurately.
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `branch_location=eq.${branch}` },
        (payload) => {
          setOrders((prev) => 
            prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
                // If it became completed, remove it from the list
                .filter(o => o.status !== 'completed' && o.status !== 'rejected')
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branch, fetchOrders, showToast]);

  const updateOrderStatus = async (orderId, newStatus) => {
    // Optimistic update
    setOrders((prev) => 
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
          .filter(o => o.status !== 'completed' && o.status !== 'rejected')
    );

    try {
      const { error: err } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (err) throw err;
    } catch (e) {
      console.error('[useKitchenOrders] update error:', e);
      showToast('Failed to update status', 'var(--color-error)');
      // Revert on failure (simple refetch)
      fetchOrders();
    }
  };

  return { orders, loading, error, updateOrderStatus };
}
