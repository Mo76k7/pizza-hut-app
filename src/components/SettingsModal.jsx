import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function SettingsModal({ onClose }) {
  const { showToast } = useApp();

  const [adminPin, setAdminPin] = useState(
    () => localStorage.getItem('admin_pin') || '0749'
  );
  const [kitchenPin, setKitchenPin] = useState(
    () => localStorage.getItem('kitchen_pin') || '4567'
  );
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!adminPin.trim() || !kitchenPin.trim()) {
      setError('PINs cannot be empty');
      return;
    }

    localStorage.setItem('admin_pin', adminPin.trim());
    localStorage.setItem('kitchen_pin', kitchenPin.trim());

    showToast('PINs updated successfully!', 'var(--color-success)');
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        display: 'flex',
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet"
        style={{
          margin: 'auto',
          width: '90%',
          maxWidth: '420px',
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: '#181824',
          border: '1px solid #2d2d3f',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-gear" style={{ color: 'var(--color-accent)' }} /> Admin & Kitchen Settings
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
          Manage access PINs for Admin and Kitchen dashboards.
        </p>

        {/* Admin PIN */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
            <i className="fa-solid fa-user-shield" style={{ marginRight: '6px', color: '#EF4444' }} />
            Admin Access PIN
          </label>
          <input
            type="text"
            value={adminPin}
            onChange={(e) => {
              setAdminPin(e.target.value);
              setError('');
            }}
            placeholder="Default: 0749"
            style={{
              width: '100%',
              backgroundColor: '#0f0f17',
              color: '#ffffff',
              border: '1px solid #3f3f5a',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '1px',
            }}
          />
        </div>

        {/* Kitchen PIN */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
            <i className="fa-solid fa-kitchen-set" style={{ marginRight: '6px', color: '#3B82F6' }} />
            Kitchen Access PIN
          </label>
          <input
            type="text"
            value={kitchenPin}
            onChange={(e) => {
              setKitchenPin(e.target.value);
              setError('');
            }}
            placeholder="Default: 4567"
            style={{
              width: '100%',
              backgroundColor: '#0f0f17',
              color: '#ffffff',
              border: '1px solid #3f3f5a',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '1px',
            }}
          />
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1, margin: 0, backgroundColor: 'transparent', border: '1px solid #3f3f5a' }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            style={{ flex: 1, margin: 0 }}
          >
            Save PINs
          </button>
        </div>
      </div>
    </div>
  );
}
