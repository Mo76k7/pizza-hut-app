import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export function usePendingPayments() {
  const [payments, setPayments] = useState({ pending: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { branch } = useApp();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('orders')
        .select('*')
        .in('payment_status', ['pending_verification', 'auto_verified', 'paid', 'payment_rejected'])
        .order('created_at', { ascending: false });
        
      if (branch !== 'All') {
        query = query.eq('branch_location', branch);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      
      const allPayments = data || [];
      const pending = allPayments.filter(p => ['pending_verification', 'auto_verified'].includes(p.payment_status));
      const history = allPayments.filter(p => ['paid', 'payment_rejected'].includes(p.payment_status));
      setPayments({ pending, history });
    } catch (err) {
      console.error('[usePendingPayments] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    const channel = supabase
      .channel('pending-payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // Simplest is just to refetch on any order change
          // For a production app, we would selectively update state.
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branch]);

  const approvePayment = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);
      if (error) throw error;
      // It will auto-refresh via postgres_changes
    } catch (err) {
      console.error('[approvePayment] error:', err);
      throw err;
    }
  };

  const rejectPayment = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'payment_rejected' })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error('[rejectPayment] error:', err);
      throw err;
    }
  };

  return { payments, loading, error, approvePayment, rejectPayment };
}
