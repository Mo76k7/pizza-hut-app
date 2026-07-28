import React from 'react';
import { useApp } from '../context/AppContext';

/**
 * Toast notification — appears at the top, auto-dismisses.
 * Key prop changes trigger re-mount → re-animation.
 */
export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className="toast-notification"
      style={{ background: toast.color || 'var(--color-primary)' }}
      role="status"
      aria-live="polite"
    >
      {toast.msg}
    </div>
  );
}
