import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function BottomNav({ currentView, onNavigate }) {
  const { cartCount, activeOrderId, t } = useApp();
  const pillRef = useRef(null);
  const navRef = useRef(null);

  // Liquid pill animation
  useEffect(() => {
    if (!navRef.current || !pillRef.current) return;
    const activeEl = navRef.current.querySelector('.nav-item.active');
    if (!activeEl) return;
    pillRef.current.style.width = `${activeEl.offsetWidth}px`;
    pillRef.current.style.transform = `translateX(${activeEl.offsetLeft}px)`;
  }, [currentView]);

  const navItems = [
    { id: 'home',  icon: 'fa-solid fa-pizza-slice',    label: t('menu_nav') },
    { id: 'cart',  icon: 'fa-solid fa-basket-shopping', label: t('tray_nav'), badge: cartCount },
    { id: 'tracker', icon: 'fa-solid fa-list-check',   label: t('order_status'), hasDot: !!activeOrderId },
  ];

  return (
    <nav className="bottom-nav" ref={navRef}>
      <div className="liquid-nav-pill" ref={pillRef} id="liquid-pill" />
      {navItems.map(({ id, icon, label, badge, hasDot }) => (
        <div
          key={id}
          className={`nav-item ${currentView === id ? 'active' : ''}`}
          id={`nav-${id}`}
          onClick={() => onNavigate(id)}
          role="button"
          tabIndex={0}
          style={{ position: 'relative' }}
          aria-label={label}
        >
          <i className={icon} />
          <span>{label}</span>
          {badge > 0 && (
            <span className="badge" id={`${id}-badge-count`}>{badge}</span>
          )}
          {hasDot && <div className="status-dot"></div>}
        </div>
      ))}
    </nav>
  );
}
