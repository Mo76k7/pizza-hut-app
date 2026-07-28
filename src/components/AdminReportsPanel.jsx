import React, { useState } from 'react';
import { useAdminReports } from '../hooks/useAdminReports';

export default function AdminReportsPanel() {
  const [period, setPeriod] = useState('daily');
  const { orders, loading, error } = useAdminReports(period);

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}>Loading reports...</div>;
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
      <div className="admin-tabs" style={{ marginBottom: 8 }}>
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
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--glass-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>#{o.order_number} - Table {o.table_number}</span>
              <span>Br {Number(o.total_price).toFixed(2)}</span>
              <span>{new Date(o.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
          {orders.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)' }}>No orders in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
