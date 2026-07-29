import React, { useState } from 'react';
import { useAdminReports } from '../hooks/useAdminReports';

export default function AdminReportsPanel() {
  const [period, setPeriod] = useState('daily');
  const { orders, loading, error, resetData } = useAdminReports(period);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const timeFormatted = `${hours}:${minutes}:${seconds}`;

    if (period === 'daily') {
      return timeFormatted;
    } else {
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      return `${day}/${month}/${year} - ${timeFormatted}`;
    }
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetData();
      setShowResetConfirm(false);
    } catch (err) {
      console.error('[AdminReportsPanel] reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  if (loading && !isResetting) return <div style={{ textAlign: 'center', padding: 20 }}>Loading reports...</div>;
  if (error) return <div style={{ color: 'var(--color-error)' }}>Error: {error}</div>;

  // Calculate metrics
  const orderCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Item ranking
  const itemSales = {};
  orders.forEach((o) => {
    (o.order_items || []).forEach((it) => {
      const key = it.item_name;
      if (!itemSales[key]) {
        itemSales[key] = { name: it.item_name, count: 0, revenue: 0 };
      }
      itemSales[key].count += it.quantity;
      itemSales[key].revenue += Number(it.price || 0) * it.quantity;
    });
  });

  const sortedItems = Object.values(itemSales).sort((a, b) => b.count - a.count);
  const topItems = sortedItems.slice(0, 5);
  const bottomItems = sortedItems.slice(-5).reverse();

  return (
    <div id="admin-reports-panel">
      {/* Header bar with period selector and Reset Data button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="admin-tabs" style={{ marginBottom: 0 }}>
          <button 
            className={`admin-tab ${period === 'daily' ? 'active' : ''}`} 
            onClick={() => setPeriod('daily')}
          >
            Daily
          </button>
          <button 
            className={`admin-tab ${period === 'weekly' ? 'active' : ''}`} 
            onClick={() => setPeriod('weekly')}
          >
            Weekly
          </button>
          <button 
            className={`admin-tab ${period === 'monthly' ? 'active' : ''}`} 
            onClick={() => setPeriod('monthly')}
          >
            Monthly
          </button>
        </div>

        <button
          className="btn-reset-data"
          onClick={() => setShowResetConfirm(true)}
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fa-solid fa-rotate-left" /> Reset Data
        </button>
      </div>

      <div id="report-content">
        <div className="report-grid">
          <div className="report-stat">
            <div className="value">{orderCount}</div>
            <div className="label">Orders</div>
          </div>
          <div className="report-stat">
            <div className="value">Br {totalRevenue.toFixed(0)}</div>
            <div className="label">Revenue</div>
          </div>
          <div className="report-stat">
            <div className="value">Br {avgOrder.toFixed(0)}</div>
            <div className="label">Avg Order</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="report-card">
            <h4 style={{ color: 'var(--color-accent)', marginBottom: 6 }}>🔥 Most Sold</h4>
            <ul className="ranking-list">
              {topItems.length > 0 ? topItems.map((it, i) => (
                <li key={it.name}>
                  <span className="rank">#{i + 1}</span>
                  <span className="name">{it.name}</span>
                  <span className="count">{it.count}x</span>
                </li>
              )) : (
                <li style={{ color: 'var(--color-text-muted)' }}>No data</li>
              )}
            </ul>
          </div>
          <div className="report-card">
            <h4 style={{ color: 'var(--color-error)', marginBottom: 6 }}>📉 Least Sold</h4>
            <ul className="ranking-list">
              {bottomItems.length > 0 ? bottomItems.map((it, i) => (
                <li key={it.name}>
                  <span className="rank">#{i + 1}</span>
                  <span className="name">{it.name}</span>
                  <span className="count">{it.count}x</span>
                </li>
              )) : (
                <li style={{ color: 'var(--color-text-muted)' }}>No data</li>
              )}
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
          <h4 style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
            Recent Orders
          </h4>
          {orders.slice(0, 10).map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--glass-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>#{o.order_number} - Table {o.table_number}</span>
              <span>Br {Number(o.total_price).toFixed(2)}</span>
              <span>{formatTimestamp(o.created_at)}</span>
            </div>
          ))}
          {orders.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', padding: '8px 0' }}>No orders in this period</div>
          )}
        </div>
      </div>

      {/* Confirmation prompt for Reset Data */}
      {showResetConfirm && (
        <div
          className="modal-overlay"
          style={{
            display: 'flex',
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div
            className="modal-sheet"
            style={{
              maxWidth: '400px',
              margin: 'auto',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#181824',
              border: '1px solid #2d2d3f',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '18px' }}>
              Reset {period.toUpperCase()} Report Data?
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
              Are you sure you want to clear historical reports and reset current view metrics for the {period} period? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, margin: 0 }}
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1, margin: 0, backgroundColor: 'var(--color-error)' }}
                onClick={handleConfirmReset}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
