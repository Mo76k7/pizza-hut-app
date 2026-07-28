import React, { useState, useCallback } from 'react';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import MenuView from './MenuView';
import CartView from './CartView';
import TrackerView from './TrackerView';
import { useApp } from '../context/AppContext';

/**
 * CustomerApp — the full customer-facing interface.
 * Layout (top to bottom, matching the HTML prototype):
 *  1. AppHeader   — always visible
 *  2. UtilityBar  — search + fasting toggle, visible only on menu view
 *  3. view-container — scrollable main content
 *  4. BottomNav   — fixed to bottom
 *  5. Toast       — floating overlay
 */
export default function CustomerApp({ onRoleSwitch, currentRole }) {
  const [currentView, setCurrentView] = useState('home');
  const { activeOrderId, t } = useApp();

  // Utility bar state — lifted here so it renders outside view-container
  const [search, setSearch] = useState('');
  const [fastingOnly, setFastingOnly] = useState(false);

  const handleNavigate = (view) => {
    if (view === 'tracker' && !activeOrderId) {
      setCurrentView('home');
      return;
    }
    setCurrentView(view);
  };

  const handleFastingToggle = useCallback((checked) => {
    setFastingOnly(checked);
  }, []);

  return (
    <div className="app-container" id="app-container">
      {/* Animated background blobs */}
      <div className="bg-mesh">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* 1. Persistent header */}
      <AppHeader />

      {/* 2. Utility bar — only on menu view, sits between header and content */}
      {currentView === 'home' && (
        <div className="utility-bar" id="utility-bar">
          <div className="search-container">
            <i
              className="fa-solid fa-search"
              style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                fontSize: 'clamp(10px,2.5vw,12px)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="search-input"
              id="menu-search"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search menu"
            />
          </div>
          <div
            className="fasting-toggle-container"
            onClick={() => handleFastingToggle(!fastingOnly)}
            role="button"
            aria-pressed={fastingOnly}
            aria-label="Toggle fasting filter"
          >
            <span>{t('fasting')}</span>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                id="fasting-toggle"
                checked={fastingOnly}
                onChange={(e) => handleFastingToggle(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      )}

      {/* 3. Main scrollable viewport */}
      <main className="view-container" id="view-viewport">
        {currentView === 'home' && (
          <MenuView
            onNavigate={handleNavigate}
            search={search}
            onSearchChange={setSearch}
            fastingOnly={fastingOnly}
            onFastingToggle={handleFastingToggle}
          />
        )}
        {currentView === 'cart' && <CartView onNavigate={handleNavigate} />}
        {currentView === 'tracker' && <TrackerView onNavigate={handleNavigate} />}
      </main>

      {/* 4. Bottom navigation */}
      <BottomNav currentView={currentView} onNavigate={handleNavigate} />

      {/* 5. Global toast */}
      <Toast />
    </div>
  );
}
