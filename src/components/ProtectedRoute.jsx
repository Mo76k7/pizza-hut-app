import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

export default function ProtectedRoute({ role, requiredPin, children }) {
  const [isUnlocked, setIsUnlocked] = useState(
    sessionStorage.getItem(`auth_${role}`) === 'true'
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isUnlocked) {
      sessionStorage.setItem(`auth_${role}`, 'true');
    }
  }, [isUnlocked, role]);

  const handleSubmit = () => {
    const activeRequiredPin = localStorage.getItem(`${role}_pin`) || requiredPin;
    if (pin === activeRequiredPin) {
      setIsUnlocked(true);
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (isUnlocked) {
    return children;
  }

  return createPortal(
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
          Enter {role === 'admin' ? 'Admin' : 'Kitchen'} Password
        </h3>
        
        <input 
          type="password" 
          placeholder="Enter PIN..." 
          value={pin} 
          onChange={(e) => {
            setPin(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{ 
            width: '100%', backgroundColor: '#0f0f17', color: '#ffffff', 
            border: '1px solid #3f3f5a', padding: '12px', margin: '16px 0', 
            borderRadius: '8px', fontSize: '16px', outline: 'none',
            textAlign: 'center', letterSpacing: '2px', boxSizing: 'border-box'
          }} 
          autoFocus
        />
        
        {error && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}
        
        <button 
          className="btn-primary" 
          onClick={handleSubmit} 
          style={{ margin: 0, width: '100%', backgroundColor: '#ef4444', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          UNLOCK
        </button>
        <button 
          className="btn-secondary" 
          onClick={handleCancel} 
          style={{ margin: 0, width: '100%', backgroundColor: 'transparent', border: 'none', color: '#9ca3af', padding: '12px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
