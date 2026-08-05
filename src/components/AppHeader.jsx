import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BRANCH_OPTIONS } from '../utils/constants';

export default function AppHeader() {
  const { lang, setLang, branch, setBranch, t, isAudioEnabled, toggleAudio } = useApp();
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="location-display">
          <p className="location-label">{t('city_label')}</p>
          <div className="location-value">
            <i className="fa-solid fa-location-dot" />
            <div className="relative">
              <button 
                className="glass-select flex items-center gap-1"
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                aria-label="Select branch"
              >
                {branch} <span className="text-[9px] opacity-70">▼</span>
              </button>
              {isBranchDropdownOpen && (
                <div className="absolute z-50 mt-2 w-48 bg-[#1a1a24]/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden left-0">
                  {BRANCH_OPTIONS.map((b) => (
                    <div 
                      key={b} 
                      className="px-4 py-3 text-white cursor-pointer hover:bg-white/10 transition-colors text-sm font-semibold"
                      onClick={() => {
                        setBranch(b);
                        setIsBranchDropdownOpen(false);
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
