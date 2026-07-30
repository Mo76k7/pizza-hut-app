import React, { useState } from 'react';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { useApp } from '../context/AppContext';

export default function AdminPaymentsPanel() {
  const { payments, loading, error, approvePayment } = usePendingPayments();
  const { showToast } = useApp();
  const [approving, setApproving] = useState({});
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'approved'

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

  if (loading) return <div style={{ padding: 20 }}>Loading payments...</div>;
  if (error) return <div style={{ padding: 20, color: 'var(--color-error)' }}>Error: {error}</div>;

  const currentPayments = activeTab === 'pending' ? payments.pending : payments.approved;

  return (
    <div className="admin-panel fade-in">
      <div className="admin-header-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--color-accent)' }} />
            Payment Verifications
          </h2>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '4px 12px', borderRadius: 20, fontSize: 13, color: '#fff' }}>
            {payments.pending.length} Pending
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8, backgroundColor: '#0f0f17', padding: 4, borderRadius: 10, border: '1px solid #29293d' }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              backgroundColor: activeTab === 'pending' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'pending' ? '#fff' : 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Pending Verifications
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              backgroundColor: activeTab === 'approved' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'approved' ? '#fff' : 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Completed / Approved
          </button>
        </div>
      </div>

      {currentPayments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
          {activeTab === 'pending' ? (
            <>
              <i className="fa-solid fa-check-circle" style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-success)' }} />
              <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>All caught up!</h3>
              <p>No payments waiting for verification.</p>
            </>
          ) : (
            <>
              <i className="fa-solid fa-history" style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-text-muted)' }} />
              <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>No history yet</h3>
              <p>Approved payments will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {currentPayments.map(p => (
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
                  <h3 style={{ margin: '0 0 4px 0', color: '#fff' }}>{p.order_number}</h3>
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
                  {activeTab === 'approved' && (
                    <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 700, marginTop: 4 }}>
                      <i className="fa-solid fa-circle-check" /> PAID
                    </div>
                  )}
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
                      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none',
                      padding: '8px', borderRadius: 8, fontSize: 12
                    }}>
                      <img src={p.receipt_image_url} alt="Receipt thumbnail" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                      <span><i className="fa-solid fa-image" /> View Full Receipt</span>
                    </a>
                  </div>
                )}
              </div>

              {activeTab === 'pending' && (
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
