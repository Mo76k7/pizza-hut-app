import React from 'react';
import AppHeader from '../components/AppHeader';
import Toast from '../components/Toast';
import { useApp } from '../context/AppContext';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import { playOrderChime } from '../utils/sound';

export default function KitchenDashboard() {
  const { t, lang } = useApp();
  const { orders, loading, error, updateOrderStatus } = useKitchenOrders();

  // Sort orders: oldest pending first, or specific priority logic
  // For simplicity: order by created_at ascending (oldest first) so they are processed in order
  const sortedOrders = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="app-container">
      <div className="bg-mesh">
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
      </div>
      
      {/* Persistent header */}
      <AppHeader />

      <main className="view-container" style={{ paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 className="display-title" style={{ margin: 0 }}>
            👨‍🍳 Kitchen Dashboard
          </h1>
          <button
            onClick={playOrderChime}
            title="Test notification chime sound"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🔊 Test Sound
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--color-primary)' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-error)' }}>
            <p>Error loading orders.</p>
            <p style={{ fontSize: 12 }}>{error}</p>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="empty-cart-state">
            <div className="empty-cart-icon">🧑‍🍳</div>
            <h3>No Orders Yet</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              Waiting for customer orders...
            </p>
          </div>
        ) : (
          <div id="kitchen-orders-container">
            {sortedOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onUpdateStatus={updateOrderStatus}
                lang={lang}
              />
            ))}
          </div>
        )}
      </main>

      <Toast />
    </div>
  );
}

function OrderCard({ order, onUpdateStatus, lang }) {
  // Determine status display info
  const statusClass = 
    order.status === 'received' ? 'pending' : 
    order.status === 'preparing' ? 'preparing' : 
    'ready';
  
  const statusLabel = 
    order.status === 'received' ? '⏳ Pending' : 
    order.status === 'accepted' ? '✅ Accepted' : 
    order.status === 'preparing' ? '🔨 Preparing' : 
    '✅ Ready';

  // Format order items
  const itemsList = (order.order_items || []).map((it) => {
    // Determine the name based on the language (we only store the name the customer saw, 
    // or ideally we store both or reference menu_items, but we saved 'item_name' which is the translated name).
    // Let's just use the item_name saved in order_items.
    const sizeStr = it.selected_size ? ` (${it.selected_size})` : '';
    const crustStr = it.selected_crust && it.selected_crust !== 'regular' ? ` (${it.selected_crust})` : '';
    return `${it.item_name}${sizeStr}${crustStr} x${it.quantity}`;
  }).join(', ');

  const timeString = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="order-card">
      <div className="order-header">
        <span className="order-id">#{order.order_number} - Table {order.table_number}</span>
        <span className="order-time">{timeString}</span>
      </div>
      
      <div className="order-items">{itemsList}</div>
      
      {order.instructions && (
        <div style={{ fontSize: 11, color: 'var(--color-warning)', marginBottom: 8, fontStyle: 'italic' }}>
          📝 {order.instructions}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span className="order-total">Total: Br {parseFloat(order.total_price).toFixed(2)}</span>
        <span className={`order-status-badge ${statusClass}`}>{statusLabel}</span>
      </div>
      
      <div className="order-actions">
        {order.status === 'received' ? (
          <button className="btn-accept" onClick={() => onUpdateStatus(order.id, 'accepted')}>
            Accept
          </button>
        ) : order.status === 'accepted' ? (
          <button className="btn-prepare" onClick={() => onUpdateStatus(order.id, 'preparing')}>
            Preparing
          </button>
        ) : order.status === 'preparing' ? (
          <button className="btn-ready" onClick={() => onUpdateStatus(order.id, 'ready')}>
            Ready
          </button>
        ) : (
          <button className="btn-secondary" style={{ marginTop: 0 }} onClick={() => onUpdateStatus(order.id, 'completed')}>
            Mark Completed
          </button>
        )}
      </div>
    </div>
  );
}
