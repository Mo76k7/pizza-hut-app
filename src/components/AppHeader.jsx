import React from 'react';
import { useApp } from '../context/AppContext';
import { BRANCH_OPTIONS } from '../utils/constants';

export default function AppHeader({ onOpenSettings }) {
  const { lang, setLang, branch, setBranch, t } = useApp();

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
        {onOpenSettings && (
          <button
            className="lang-toggle"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Admin Settings"
            style={{
              padding: '6px 10px',
              fontSize: '14px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⚙️
          </button>
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

    </header>
  );
}
