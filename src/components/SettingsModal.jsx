import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';

export default function SettingsModal({ onClose }) {
  const { showToast, paymentAccounts, refreshPaymentSettings } = useApp();

  const [adminPin, setAdminPin] = useState(
    () => localStorage.getItem('admin_pin') || '0749'
  );
  const [kitchenPin, setKitchenPin] = useState(
    () => localStorage.getItem('kitchen_pin') || '4567'
  );

  const [telebirrNumber, setTelebirrNumber] = useState(
    () => paymentAccounts?.telebirr?.number || '0905868312'
  );
  const [telebirrName, setTelebirrName] = useState(
    () => paymentAccounts?.telebirr?.name || 'Pizza Hut Telebirr'
  );
  const [cbeNumber, setCbeNumber] = useState(
    () => paymentAccounts?.cbe?.number || '1000123456789'
  );
  const [cbeName, setCbeName] = useState(
    () => paymentAccounts?.cbe?.name || 'Pizza Hut CBE Birr'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch current payment_settings from Supabase on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error: fetchErr } = await supabase
          .from('payment_settings')
          .select('*')
          .limit(1)
          .single();

        if (!fetchErr && data) {
          if (data.telebirr_number) setTelebirrNumber(data.telebirr_number);
          if (data.telebirr_name) setTelebirrName(data.telebirr_name);
          if (data.cbe_number) setCbeNumber(data.cbe_number);
          if (data.cbe_name) setCbeName(data.cbe_name);
        }
      } catch (err) {
        console.warn('[SettingsModal] fetch payment_settings warning:', err);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!adminPin.trim() || !kitchenPin.trim()) {
      setError('PINs cannot be empty');
      return;
    }
    if (!telebirrNumber.trim() || !cbeNumber.trim()) {
      setError('Payment account numbers cannot be empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      localStorage.setItem('admin_pin', adminPin.trim());
      localStorage.setItem('kitchen_pin', kitchenPin.trim());

      const settingsPayload = {
        id: 1,
        telebirr_number: telebirrNumber.trim(),
        telebirr_name: telebirrName.trim() || 'Pizza Hut Telebirr',
        cbe_number: cbeNumber.trim(),
        cbe_name: cbeName.trim() || 'Pizza Hut CBE Birr',
        updated_at: new Date().toISOString(),
      };

      // Save to Supabase payment_settings table
      const { error: dbErr } = await supabase
        .from('payment_settings')
        .upsert(settingsPayload);

      if (dbErr) {
        console.warn('[SettingsModal] upsert payment_settings warning:', dbErr.message);
      }

      // Save local backup for instant display
      localStorage.setItem('payment_settings', JSON.stringify(settingsPayload));

      if (refreshPaymentSettings) {
        await refreshPaymentSettings();
      }

      showToast('Settings & Payment Accounts saved successfully!', 'var(--color-success)');
      onClose();
    } catch (err) {
      console.error('[SettingsModal] save error:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
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
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
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
            <i className="fa-solid fa-gear" style={{ color: 'var(--color-accent)' }} /> System Settings
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
          Manage access PINs and dynamic customer payment account details.
        </p>

        {/* Section 1: Dashboard PINs */}
        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '14px' }}>
          <h4 style={{ color: 'var(--color-accent)', margin: '0 0 10px', fontSize: '14px' }}>🔐 Dashboard PINs</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>
                Admin Access PIN
              </label>
              <input
                type="text"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Default: 0749"
                style={{
                  width: '100%',
                  backgroundColor: '#0f0f17',
                  color: '#ffffff',
                  border: '1px solid #3f3f5a',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>
                Kitchen Access PIN
              </label>
              <input
                type="text"
                value={kitchenPin}
                onChange={(e) => setKitchenPin(e.target.value)}
                placeholder="Default: 4567"
                style={{
                  width: '100%',
                  backgroundColor: '#0f0f17',
                  color: '#ffffff',
                  border: '1px solid #3f3f5a',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Payment Accounts Customization */}
        <div>
          <h4 style={{ color: 'var(--color-accent)', margin: '0 0 10px', fontSize: '14px' }}>💳 Dynamic Payment Accounts</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Telebirr Settings */}
            <div style={{ backgroundColor: '#0f0f17', padding: 12, borderRadius: 8, border: '1px solid #2d2d42' }}>
              <div style={{ fontWeight: 600, color: '#3b82f6', fontSize: 13, marginBottom: 8 }}>📱 Telebirr Account</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Telebirr Number (e.g. 0905868312)"
                  value={telebirrNumber}
                  onChange={(e) => setTelebirrNumber(e.target.value)}
                  style={{
                    width: '100%', backgroundColor: '#181824', color: '#fff',
                    border: '1px solid #3f3f5a', padding: '8px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box'
                  }}
                />
                <input
                  type="text"
                  placeholder="Telebirr Account Holder Name"
                  value={telebirrName}
                  onChange={(e) => setTelebirrName(e.target.value)}
                  style={{
                    width: '100%', backgroundColor: '#181824', color: '#fff',
                    border: '1px solid #3f3f5a', padding: '8px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* CBE Settings */}
            <div style={{ backgroundColor: '#0f0f17', padding: 12, borderRadius: 8, border: '1px solid #2d2d42' }}>
              <div style={{ fontWeight: 600, color: '#22c55e', fontSize: 13, marginBottom: 8 }}>🏦 CBE Birr Account</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  placeholder="CBE Account Number (e.g. 1000123456789)"
                  value={cbeNumber}
                  onChange={(e) => setCbeNumber(e.target.value)}
                  style={{
                    width: '100%', backgroundColor: '#181824', color: '#fff',
                    border: '1px solid #3f3f5a', padding: '8px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box'
                  }}
                />
                <input
                  type="text"
                  placeholder="CBE Account Holder Name"
                  value={cbeName}
                  onChange={(e) => setCbeName(e.target.value)}
                  style={{
                    width: '100%', backgroundColor: '#181824', color: '#fff',
                    border: '1px solid #3f3f5a', padding: '8px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ flex: 1, margin: 0, backgroundColor: 'transparent', border: '1px solid #3f3f5a' }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
            style={{ flex: 1, margin: 0 }}
          >
            {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
