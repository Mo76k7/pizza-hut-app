import React, { useState } from 'react';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { useApp } from '../context/AppContext';

export default function AdminPaymentsPanel() {
  const { payments, loading, error, approvePayment } = usePendingPayments();
  const { showToast } = useApp();
  const [approving, setApproving] = useState({});

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to manually approve this payment?')) return;
    setApproving(prev => ({ ...prev, [id]: true }));
    try {
      await approvePayment(id);
      showToast('Payment manually approved', 'var(--color-success)');
    } catch (err) {
      showToast('Failed to approve payment', 'var(--color-error)');
    } finally {
      setApproving(prev => ({ ...prev, [id]: false }));
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading pending payments...</div>;
  if (error) return <div style={{ padding: 20, color: 'var(--color-error)' }}>Error: {error}</div>;

  return (
    <div className="admin-panel fade-in">
      <div className="admin-header-row">
        <h2 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--color-accent)' }} />
          Pending Verifications
        </h2>
        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '4px 12px', borderRadius: 20, fontSize: 13, color: '#fff' }}>
          {payments.length} Pending
        </div>
      </div>

      {payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
          <i className="fa-solid fa-check-circle" style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-success)' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>All caught up!</h3>
          <p>No payments waiting for verification.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {payments.map(p => (
            <div key={p.id} style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: '#fff' }}>Order {p.order_number}</h3>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                    <i className="fa-solid fa-clock" /> {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--color-accent)' }}>
                    Br {p.total_price}
                  </div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {p.payment_method}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>Txn Ref / ID</div>
                  <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 }}>{p.txn_id || 'N/A'}</div>
                </div>
                
                {p.receipt_image_url && (
                  <div>
                    <a href={p.receipt_image_url} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none',
                      padding: '6px 12px', borderRadius: 6, fontSize: 13
                    }}>
                      <i className="fa-solid fa-image" /> View Receipt
                    </a>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button 
                  className="btn-primary"
                  onClick={() => handleApprove(p.id)}
                  disabled={approving[p.id]}
                  style={{ padding: '8px 16px', fontSize: 14 }}
                >
                  {approving[p.id] ? (
                    <><i className="fa-solid fa-spinner fa-spin" /> Approving...</>
                  ) : (
                    <><i className="fa-solid fa-check" /> Override & Approve</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
