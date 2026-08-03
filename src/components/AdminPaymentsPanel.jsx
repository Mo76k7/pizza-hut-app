import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export default function AdminPaymentsPanel() {
  const { showToast, branch } = useApp();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  const [proofs, setProofs] = useState([]);
  const [smsLogs, setSmsLogs] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [rejectingProof, setRejectingProof] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [zoomedImage, setZoomImage] = useState(null);
  const [auditProof, setAuditProof] = useState(null);
  
  // History Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payment_proofs')
        .select(`
          *,
          orders!inner(
            *,
            order_items(*)
          )
        `)
        .order('created_at', { ascending: false });
        
      if (branch !== 'All') {
        query = query.eq('orders.branch_location', branch);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setProofs(data || []);
      
      // Fetch corresponding SMS logs
      const txnIds = (data || []).map(p => p.orders?.txn_id).filter(Boolean);
      if (txnIds.length > 0) {
        const { data: smsData, error: smsError } = await supabase
          .from('bank_sms_logs')
          .select('*')
          .in('extracted_txn_id', txnIds);
          
        if (!smsError && smsData) {
          const smsMap = {};
          smsData.forEach(sms => {
            smsMap[sms.extracted_txn_id] = sms;
          });
          setSmsLogs(smsMap);
        }
      }
    } catch (err) {
      console.error('[AdminPaymentsPanel] fetch error:', err);
      showToast('Failed to load payment proofs', 'var(--color-error)');
    } finally {
      setLoading(false);
    }
  }, [branch, showToast]);

  useEffect(() => {
    fetchProofs();

    const channel = supabase
      .channel('admin-payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_proofs' },
        () => fetchProofs()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchProofs]);

  const handleApprove = async (proof) => {
    if (!window.confirm(`Approve payment for Order #${proof.orders?.order_number}?`)) return;
    try {
      const { error: proofErr } = await supabase
        .from('payment_proofs')
        .update({ status: 'approved' })
        .eq('id', proof.id);
      if (proofErr) throw proofErr;

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ payment_status: 'approved' })
        .eq('id', proof.order_id);
      if (orderErr) throw orderErr;

      showToast(`Order #${proof.orders?.order_number} approved!`, 'var(--color-success)');
    } catch (err) {
      console.error('Approve error:', err);
      showToast('Failed to approve payment', 'var(--color-error)');
    }
  };

  const submitReject = async () => {
    if (!rejectingProof || !rejectionReason.trim()) {
      showToast('Please select or enter a rejection reason', 'var(--color-warning)');
      return;
    }
    
    try {
      const { error: proofErr } = await supabase
        .from('payment_proofs')
        .update({ status: 'rejected', rejection_reason: rejectionReason.trim() })
        .eq('id', rejectingProof.id);
      if (proofErr) throw proofErr;

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ payment_status: 'rejected' })
        .eq('id', rejectingProof.order_id);
      if (orderErr) throw orderErr;

      // Unmatch the bank SMS log
      const txnId = rejectingProof.orders?.txn_id;
      if (txnId) {
        await supabase
          .from('bank_sms_logs')
          .update({ is_matched: false })
          .eq('extracted_txn_id', txnId);
      }

      showToast(`Payment rejected for Order #${rejectingProof.orders?.order_number}`, 'var(--color-error)');
      setRejectingProof(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Reject error:', err);
      showToast('Failed to reject payment', 'var(--color-error)');
    }
  };

  if (loading && proofs.length === 0) return <div style={{ padding: 20 }}>Loading payments...</div>;

  const pendingProofs = proofs.filter(p => p.status === 'pending_admin');
  
  let historyProofs = proofs.filter(p => p.status === 'approved' || p.status === 'rejected');
  
  if (filterMethod !== 'all') {
    historyProofs = historyProofs.filter(p => p.orders?.payment_method === filterMethod);
  }
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    historyProofs = historyProofs.filter(p => 
      p.orders?.order_number?.toLowerCase().includes(q) ||
      p.orders?.txn_id?.toLowerCase().includes(q)
    );
  }

  const renderProofCard = (proof, isHistory = false) => {
    const order = proof.orders;
    const sms = smsLogs[order?.txn_id];

    return (
      <div key={proof.id} style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative'
      }}>
        {isHistory && (
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            {proof.status === 'approved' ? (
              <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                Approved
              </span>
            ) : (
              <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                Rejected
              </span>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: isHistory ? 80 : 0 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff' }}>{order?.order_number}</h3>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 8 }}>
              Table {order?.table_number} • {new Date(proof.created_at).toLocaleString()}
            </div>
            {order?.order_items && order.order_items.length > 0 && (
              <div style={{ fontSize: 12, color: '#aaa', display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {order.order_items.map(it => (
                  <span key={it.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                    {it.quantity}x {it.item_name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--color-accent)' }}>
              Br {order?.total_price}
            </div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              {order?.payment_method}
            </div>
          </div>
        </div>

        {!isHistory && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {/* Uploaded Receipt */}
            <div style={{ flex: 1, minWidth: 240, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>UPLOADED RECEIPT</div>
              {proof.screenshot_url ? (
                <div 
                  onClick={() => setZoomImage(proof.screenshot_url)}
                  style={{ cursor: 'zoom-in', display: 'block', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}
                >
                  <img src={proof.screenshot_url} alt="Receipt" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic', padding: 20, textAlign: 'center' }}>No image uploaded</div>
              )}
              <div style={{ marginTop: 8, fontSize: 13, color: '#ddd' }}>
                Extracted OCR Amount: <strong style={{ color: '#fff' }}>{proof.ocr_amount ? `Br ${proof.ocr_amount}` : 'N/A'}</strong>
              </div>
            </div>

            {/* Matched SMS Details */}
            <div style={{ flex: 1, minWidth: 240, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>MATCHED BANK SMS</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 0.5, backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                ID: {order?.txn_id || 'N/A'}
              </div>
              {sms ? (
                <>
                  <div style={{ fontSize: 12, color: '#999', backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, marginBottom: 8, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    "{sms.raw_message}"
                  </div>
                  <div style={{ fontSize: 13, color: '#ddd' }}>
                    Matched SMS Amount: <strong style={{ color: '#3b82f6' }}>Br {sms.extracted_amount}</strong>
                  </div>
                </>
              ) : (
                <div style={{ color: '#ef4444', fontSize: 13, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 6 }}>
                  ⚠️ No matching SMS record found for this transaction ID.
                </div>
              )}
            </div>
          </div>
        )}
        
        {isHistory && proof.status === 'rejected' && proof.rejection_reason && (
          <div style={{ marginTop: 4, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', borderRadius: 4, fontSize: 13, color: '#ffcdcd' }}>
            <strong>Rejection Reason:</strong> {proof.rejection_reason}
          </div>
        )}

        {!isHistory ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button 
              className="btn-secondary"
              onClick={() => setRejectingProof(proof)}
              style={{ margin: 0, padding: '8px 16px', fontSize: 13, borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            >
              <i className="fa-solid fa-xmark" /> Reject
            </button>
            <button 
              className="btn-primary"
              onClick={() => handleApprove(proof)}
              style={{ margin: 0, padding: '8px 16px', fontSize: 13 }}
            >
              <i className="fa-solid fa-check" /> Approve
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button 
              className="btn-secondary"
              onClick={() => setAuditProof(proof)}
              style={{ margin: 0, padding: '8px 16px', fontSize: 13 }}
            >
              <i className="fa-solid fa-magnifying-glass" /> View Full Audit
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-panel fade-in">
      <div className="admin-header-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--color-accent)' }} />
            Payment Verifications
          </h2>
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
            Pending Approvals {pendingProofs.length > 0 && `(${pendingProofs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              backgroundColor: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'history' ? '#fff' : 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Payment History
          </button>
        </div>
      </div>

      {activeTab === 'pending' ? (
        pendingProofs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
            <i className="fa-solid fa-check-circle" style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-success)' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>All caught up!</h3>
            <p>No payments waiting for verification.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {pendingProofs.map(p => renderProofCard(p, false))}
          </div>
        )
      ) : (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input 
              type="text" 
              placeholder="Search Order ID or Txn ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, backgroundColor: '#0f0f17', border: '1px solid #29293d', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
            />
            <select 
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              style={{ backgroundColor: '#0f0f17', border: '1px solid #29293d', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
            >
              <option value="all">All Methods</option>
              <option value="telebirr">Telebirr</option>
              <option value="cbe">CBE</option>
            </select>
          </div>
          
          {historyProofs.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
               <i className="fa-solid fa-history" style={{ fontSize: 48, marginBottom: 16 }} />
               <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>No history found</h3>
             </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {historyProofs.map(p => renderProofCard(p, true))}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingProof && (
        <div className="modal-overlay" style={{ zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-container" style={{ maxWidth: 400, padding: 24, backgroundColor: '#181824', borderRadius: 16, border: '1px solid #2d2d3f' }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Reject Payment</h3>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>
              Order #{rejectingProof.orders?.order_number}. This will unlock the SMS record and ask the customer to retry.
            </p>
            
            <label style={{ display: 'block', color: '#fff', fontSize: 13, marginBottom: 6 }}>Rejection Reason *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {['Amount mismatch', 'Illegible receipt screenshot', 'Fraudulent/edited image', 'Transaction ID not in screenshot'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: rejectionReason === reason ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${rejectionReason === reason ? '#ef4444' : 'transparent'}`,
                    color: rejectionReason === reason ? '#ffcdcd' : '#ccc',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  {reason}
                </button>
              ))}
              <input 
                type="text"
                placeholder="Or type a custom reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ backgroundColor: '#0f0f17', border: '1px solid #29293d', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: 13, marginTop: 4 }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1, margin: 0 }} onClick={() => setRejectingProof(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, margin: 0, backgroundColor: 'var(--color-error)' }} onClick={submitReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="modal-overlay" style={{ zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.9)' }} onClick={() => setZoomImage(null)}>
          <div style={{ position: 'relative', width: '90%', height: '90%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              onClick={() => setZoomImage(null)}
              style={{ position: 'absolute', top: -10, right: -10, background: 'var(--color-error)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <img src={zoomedImage} alt="Zoomed Receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {auditProof && (
        <div className="modal-overlay" style={{ zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-container" style={{ maxWidth: 600, padding: 24, backgroundColor: '#181824', borderRadius: 16, border: '1px solid #2d2d3f', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Payment Audit Detail</h3>
              <button onClick={() => setAuditProof(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 20 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Receipt */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>UPLOADED RECEIPT</div>
                {auditProof.screenshot_url ? (
                  <div 
                    onClick={() => setZoomImage(auditProof.screenshot_url)}
                    style={{ cursor: 'zoom-in', display: 'block', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}
                  >
                    <img src={auditProof.screenshot_url} alt="Receipt" style={{ width: '100%', maxHeight: 250, objectFit: 'contain', display: 'block', backgroundColor: '#000' }} />
                  </div>
                ) : (
                  <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic', padding: 20, textAlign: 'center' }}>No image uploaded</div>
                )}
              </div>

              {/* SMS & Details */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600 }}>STATUS</div>
                  {auditProof.status === 'approved' ? (
                    <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Approved</span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Rejected</span>
                  )}
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
                    Processed At: {new Date(auditProof.created_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600 }}>MATCHED BANK SMS</div>
                  {smsLogs[auditProof.orders?.txn_id] ? (
                    <>
                      <div style={{ fontSize: 12, color: '#999', backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        "{smsLogs[auditProof.orders?.txn_id].raw_message}"
                      </div>
                      <div style={{ fontSize: 13, color: '#ddd', marginTop: 4 }}>
                        Matched Amount: <strong style={{ color: '#3b82f6' }}>Br {smsLogs[auditProof.orders?.txn_id].extracted_amount}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#ef4444', fontSize: 13, fontStyle: 'italic' }}>No matching SMS record.</div>
                  )}
                </div>

                {auditProof.status === 'rejected' && auditProof.rejection_reason && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600 }}>REJECTION REASON</div>
                    <div style={{ fontSize: 13, color: '#ffcdcd', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 6 }}>
                      {auditProof.rejection_reason}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setAuditProof(null)} style={{ margin: 0, padding: '8px 16px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
