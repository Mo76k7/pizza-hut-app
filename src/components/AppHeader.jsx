import React from 'react';
import { useApp } from '../context/AppContext';
import { BRANCH_OPTIONS } from '../utils/constants';

export default function AppHeader() {
  const { lang, setLang, branch, setBranch, t, isAudioEnabled, toggleAudio } = useApp();

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
        {/* Audio Toggle */}
        <button
          onClick={toggleAudio}
          className="lang-toggle"
          title={isAudioEnabled ? 'Mute Notifications' : 'Unmute Notifications'}
          style={{ padding: '0 10px', fontSize: 16 }}
        >
          <i className={`fa-solid ${isAudioEnabled ? 'fa-bell' : 'fa-bell-slash'}`} style={{ color: isAudioEnabled ? 'var(--color-accent)' : '#666' }} />
        </button>
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
