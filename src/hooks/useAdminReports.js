import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export function useAdminReports(period = 'daily') {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { branch } = useApp();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      let startDate;

      if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(0); // All time
      }

      const { data, error: err } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('branch_location', branch)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (err) throw err;
      setOrders(data || []);
    } catch (e) {
      console.error('[useAdminReports]', e);
      setError(e.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [branch, period]);

  useEffect(() => {
    fetchReport();

    const channel = supabase
      .channel('admin-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchReport();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReport]);

  return { orders, loading, error, refetch: fetchReport };
}
