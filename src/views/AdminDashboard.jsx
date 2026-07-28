import React, { useState } from 'react';
import AppHeader from '../components/AppHeader';
import Toast from '../components/Toast';
import AdminMenuPanel from '../components/AdminMenuPanel';
import AdminReportsPanel from '../components/AdminReportsPanel';

export default function AdminDashboard({ onRoleSwitch, currentRole }) {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' or 'reports'

  return (
    <div className="app-container">
      <div className="bg-mesh">
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
      </div>
      
      {/* Persistent header */}
      <AppHeader onRoleSwitch={onRoleSwitch} currentRole={currentRole} />

      <main className="view-container" style={{ paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
        <h1 className="display-title" style={{ marginBottom: 10 }}>
          ⚙️ Admin Dashboard
        </h1>

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
        </div>

        {activeTab === 'menu' && <AdminMenuPanel />}
        {activeTab === 'reports' && <AdminReportsPanel />}
      </main>

      <Toast />
    </div>
  );
}
