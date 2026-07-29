import React, { useState } from 'react';
import AppHeader from '../components/AppHeader';
import Toast from '../components/Toast';
import AdminMenuPanel from '../components/AdminMenuPanel';
import AdminReportsPanel from '../components/AdminReportsPanel';
import AdminPaymentsPanel from '../components/AdminPaymentsPanel';
import SettingsModal from '../components/SettingsModal';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' or 'reports'
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  return (
    <div className="app-container">
      <div className="bg-mesh">
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
      </div>
      
      {/* Persistent header with settings icon handler */}
      <AppHeader onOpenSettings={() => setShowSettingsModal(true)} />

      <main className="view-container" style={{ paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h1 className="display-title" style={{ margin: 0 }}>
            ⚙️ Admin Dashboard
          </h1>
          <button
            onClick={() => setShowSettingsModal(true)}
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
            <i className="fa-solid fa-gear" style={{ color: 'var(--color-accent)' }} /> Settings
          </button>
        </div>

        <div className="admin-tabs" id="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            <i className="fa-solid fa-list" /> Menu
          </button>
          <button 
            className={`admin-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <i className="fa-solid fa-chart-simple" /> Reports
          </button>
          <button 
            className={`admin-tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            <i className="fa-solid fa-file-invoice-dollar" /> Payments
          </button>
        </div>

        {activeTab === 'menu' && <AdminMenuPanel />}
        {activeTab === 'reports' && <AdminReportsPanel />}
        {activeTab === 'payments' && <AdminPaymentsPanel />}
      </main>

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      <Toast />
    </div>
  );
}
