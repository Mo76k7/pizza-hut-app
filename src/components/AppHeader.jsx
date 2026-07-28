import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { BRANCH_OPTIONS } from '../utils/constants';

export default function AppHeader({ onRoleSwitch, currentRole }) {
  const { lang, setLang, branch, setBranch, t } = useApp();
  
  const [authModal, setAuthModal] = useState({ open: false, role: null });
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');

  const handleRoleClick = (role) => {
    if (role === 'customer') {
      onRoleSwitch('customer');
      return;
    }
    const token = sessionStorage.getItem(`auth_${role}`);
    if (token) {
      onRoleSwitch(role);
      return;
    }
    setAuthModal({ open: true, role });
    setPin('');
    setAuthError('');
  };

  const handlePinSubmit = () => {
    const { role } = authModal;
    const requiredPin = role === 'admin' ? '0749' : '4567';
    
    if (pin === requiredPin) {
      sessionStorage.setItem(`auth_${role}`, 'true');
      onRoleSwitch(role);
      setAuthModal({ open: false, role: null });
      setAuthError('');
    } else {
      setAuthError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="location-display">
          <p className="location-label">{t('city_label')}</p>
          <div className="location-value">
            <i className="fa-solid fa-location-dot" />
            <select
              className="glass-select"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              aria-label="Select branch"
            >
              {BRANCH_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Role selector — shown when onRoleSwitch is provided */}
        {onRoleSwitch && (
          <div className="role-selector" id="role-selector">
            {['customer', 'kitchen', 'admin'].map((role) => (
              <button
                key={role}
                className={`role-btn ${currentRole === role ? 'active' : ''}`}
                onClick={() => handleRoleClick(role)}
              >
                <i className={`fa-solid fa-${role === 'customer' ? 'user' : role === 'kitchen' ? 'utensils' : 'gauge-high'}`} />
                {' '}{role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Language toggles */}
        <button
          className={`lang-toggle ${lang === 'en' ? 'active-lang' : ''}`}
          onClick={() => setLang('en')}
          id="lang-en"
          aria-label="Switch to English"
        >
          EN
        </button>
        <button
          className={`lang-toggle amharic ${lang === 'am' ? 'active-lang' : ''}`}
          onClick={() => setLang('am')}
          id="lang-am"
          aria-label="Switch to Amharic"
        >
          አማ
        </button>

        <div className="brand-logo">PIZZA HUT</div>
      </div>

      {/* Password Modal via Portal to escape stacking context */}
      {authModal.open && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            margin: 'auto', width: '90%', maxWidth: '400px',
            padding: '24px', borderRadius: '12px',
            backgroundColor: '#181824', opacity: 1, border: '1px solid #2d2d3f',
            zIndex: 100000,
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', textAlign: 'center' }}>
              Enter {authModal.role === 'admin' ? 'Admin' : 'Kitchen'} Password
            </h3>
            
            <input 
              type="password" 
              placeholder="Enter PIN..." 
              value={pin} 
              onChange={(e) => {
                setPin(e.target.value);
                setAuthError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              style={{ 
                width: '100%', backgroundColor: '#0f0f17', color: '#ffffff', 
                border: '1px solid #3f3f5a', padding: '12px', margin: '16px 0', 
                borderRadius: '8px', fontSize: '16px', outline: 'none',
                textAlign: 'center', letterSpacing: '2px'
              }} 
              autoFocus
            />
            
            {authError && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{authError}</div>}
            
            <button 
              className="btn-primary" 
              onClick={handlePinSubmit} 
              style={{ margin: 0, width: '100%', backgroundColor: '#ef4444', color: '#fff' }}
            >
              UNLOCK
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setAuthModal({ open: false, role: null });
                setAuthError('');
              }} 
              style={{ margin: 0, width: '100%', backgroundColor: 'transparent', border: 'none' }}
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
