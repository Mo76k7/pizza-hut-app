import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useMenu } from '../hooks/useMenu';
import ProductModal from '../components/ProductModal';

const DIETARY_ICONS = { spicy: '🌶️', vegetarian: '🌱', fasting: '✝️' };

function getDietaryIcons(tags) {
  if (!tags || !tags.length) return null;
  return tags.map((tag) => DIETARY_ICONS[tag]).filter(Boolean);
}

function getBasePrice(item) {
  if (item.item_type === 'pizza' && item.prices_json) {
    return item.prices_json.medium || item.prices_json.small || item.base_price || item.price || 0;
  }
  return item.base_price || item.price || 0;
}

export default function MenuView({ onNavigate, search = '', onSearchChange, fastingOnly = false, onFastingToggle }) {
  const { lang, getItemName, getItemDesc, getCatName, t, cartCount } = useApp();
  const { categories, itemsByCategory, loading, error } = useMenu();

  const [activeCategory, setActiveCategory] = useState('all');
  const [sort, setSort] = useState('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const categoryScrollRef = useRef(null);

  // Determine active category object for title
  const activeCat = categories.find((c) => c.id === activeCategory);

  // Auto-jump to fasting category when fasting toggle fires
  const prevFasting = React.useRef(false);
  React.useEffect(() => {
    if (fastingOnly && !prevFasting.current) {
      const fastingCat = categories.find(
        (c) => c.name.toLowerCase().includes('fasting') || c.name_am?.includes('ጾም')
      );
      if (fastingCat) setActiveCategory(fastingCat.id);
    }
    prevFasting.current = fastingOnly;
  }, [fastingOnly, categories]);

  // Items for current category + filtering + sorting
  const displayItems = useMemo(() => {
    let items = [];

    if (search.trim()) {
      // Search across all categories
      Object.values(itemsByCategory).flat().forEach((item) => {
        const n = getItemName(item).toLowerCase();
        const d = getItemDesc(item).toLowerCase();
        if (n.includes(search.toLowerCase()) || d.includes(search.toLowerCase())) {
          items.push(item);
        }
      });
    } else {
      if (activeCategory === 'all') {
        items = Object.values(itemsByCategory).flat();
      } else {
        items = itemsByCategory[activeCategory] || [];
      }
    }

    // Fasting filter
    if (fastingOnly) {
      items = items.filter(
        (i) => (i.dietary_tags || []).includes('fasting')
      );
    }

    // Sorting
    const sorted = [...items];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => getBasePrice(a) - getBasePrice(b));
        break;
      case 'price-desc':
        sorted.sort((a, b) => getBasePrice(b) - getBasePrice(a));
        break;
      case 'name-asc':
        sorted.sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
        break;
      default:
        sorted.sort((a, b) => {
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return 0;
        });
    }

    return sorted;
  }, [activeCategory, itemsByCategory, search, fastingOnly, sort, getItemName, getItemDesc]);

  const selectCategory = (id) => {
    setActiveCategory(id);
    if (onSearchChange) onSearchChange('');
    setSort('default');
  };

  const scrollCategories = (amt) => {
    categoryScrollRef.current?.scrollBy({ left: amt, behavior: 'smooth' });
  };

  const SORT_OPTIONS = [
    { id: 'default',    label: t('sort_popular'),    icon: 'fa-star' },
    { id: 'price-asc',  label: t('sort_price_low'),  icon: 'fa-arrow-up' },
    { id: 'price-desc', label: t('sort_price_high'), icon: 'fa-arrow-down' },
    { id: 'name-asc',   label: t('sort_name'),       icon: 'fa-font' },
  ];

  const currentSortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || t('sort_popular');

  if (loading) return <MenuSkeleton />;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-error)' }}>
      <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 32, marginBottom: 12 }} />
      <p style={{ marginBottom: 12 }}>Failed to load menu</p>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{error}</p>
    </div>
  );

  return (
    <div className="app-view">
      <h1 className="display-title" style={{ marginTop: '4px' }}>
        <span>{t('explore')}</span>{' '}<br />
        <span style={{ color: 'var(--color-primary)' }}>{t('delicious_menu')}</span>
      </h1>

      {/* Category scroll bar */}
      <div className="category-scroll-wrapper">
        <button className="scroll-arrow" onClick={() => scrollCategories(-120)} aria-label="Scroll left">
          <i className="fa-solid fa-chevron-left" />
        </button>
        <div className="category-scroll-container" ref={categoryScrollRef} id="category-scroll-container">
          <div className="category-scroll" id="categories-bar">
            <div
              className={`cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => selectCategory('all')}
              role="button"
              tabIndex={0}
            >
              All
            </div>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`cat-pill ${cat.id === activeCategory ? 'active' : ''}`}
                onClick={() => selectCategory(cat.id)}
                role="button"
                tabIndex={0}
              >
                {getCatName(cat)}
              </div>
            ))}
          </div>
        </div>
        <button className="scroll-arrow" onClick={() => scrollCategories(120)} aria-label="Scroll right">
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* Section header + sort */}
      <div className="section-header">
        <h2 id="current-category-title">
          {search.trim() ? `Results for "${search}"` : (activeCategory === 'all' ? 'All Items' : (activeCat ? getCatName(activeCat) : ''))}
        </h2>
        <div className="sort-wrapper" id="sort-wrapper">
          <button
            className={`sort-btn ${showSortDropdown ? 'open' : ''}`}
            id="sort-btn"
            onClick={() => setShowSortDropdown((s) => !s)}
            aria-haspopup="listbox"
          >
            <i className="fa-solid fa-arrow-up-wide-short" />
            <span id="sort-label">{currentSortLabel}</span>
            <i className="fa-solid fa-chevron-down" />
          </button>

          {showSortDropdown && (
            <div className="sort-dropdown show" id="sort-dropdown" role="listbox">
              {SORT_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`sort-option ${sort === opt.id ? 'selected' : ''}`}
                  data-sort={opt.id}
                  onClick={() => { setSort(opt.id); setShowSortDropdown(false); }}
                  role="option"
                  aria-selected={sort === opt.id}
                >
                  <i className={`fa-solid ${opt.icon}`} /> {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close sort dropdown */}
      {showSortDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setShowSortDropdown(false)}
        />
      )}

      {/* Product grid */}
      {displayItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          {t('no_items')}
        </div>
      ) : (
        <div className="product-grid" id="products-target-grid">
          {displayItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              onOpen={setModalItem}
              getItemName={getItemName}
              getItemDesc={getItemDesc}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Floating tray button */}
      {cartCount > 0 && (
        <button
          className="floating-tray-btn visible"
          id="floating-tray-btn"
          onClick={() => onNavigate('cart')}
        >
          <i className="fa-solid fa-basket-shopping" />
          <span>{t('view_tray')}</span>
          <span className="floating-badge" id="floating-badge-count">{cartCount}</span>
        </button>
      )}

      {/* Product modal */}
      {modalItem && (
        <ProductModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}


// ──────────────────────────────────────────────
// ProductCard
// ──────────────────────────────────────────────
function ProductCard({ item, onOpen, getItemName, getItemDesc, t }) {
  const isSoldOut = item.inventory_status === 'sold-out';
  const isLimited = item.inventory_status === 'limited';
  const dietIcons = getDietaryIcons(item.dietary_tags || []);

  const displayPrice = item.item_type === 'pizza'
    ? `Br ${item.prices_json?.medium || item.base_price || item.price || 0}`
    : `Br ${item.base_price || item.price || 0}`;

  return (
    <div
      className={`product-card ${isSoldOut ? 'sold-out' : ''}`}
      id={`card-${item.id}`}
      onClick={!isSoldOut ? () => onOpen(item) : undefined}
      role={isSoldOut ? undefined : 'button'}
      tabIndex={isSoldOut ? undefined : 0}
    >
      <div className="img-wrapper">
        {item.popular && <div className="product-badge">{t('popular')}</div>}
        {isSoldOut && <div className="inventory-badge badge-sold-out">{t('sold_out')}</div>}
        {isLimited && <div className="inventory-badge badge-limited">{t('limited')}</div>}
        {dietIcons && dietIcons.length > 0 && (
          <div className="dietary-badges">
            {dietIcons.map((icon, i) => (
              <div key={i} className="dietary-icon">{icon}</div>
            ))}
          </div>
        )}
        <img
          src={item.image_url || '/pizza-placeholder.jpg'}
          alt={getItemName(item)}
          loading="lazy"
          onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
        />
      </div>

      <div className="product-info">
        <h4>{getItemName(item)}</h4>
        <p>{getItemDesc(item)}</p>
        <div className="product-price-row">
          <span className="product-price">{displayPrice}</span>
          {isSoldOut
            ? <span style={{ color: '#EF4444', fontSize: '10px' }}>N/A</span>
            : <i className="fa-solid fa-circle-plus add-icon-btn" />
          }
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Loading skeleton
// ──────────────────────────────────────────────
function MenuSkeleton() {
  return (
    <div className="app-view">
      <div className="loading-skeleton" style={{ height: 40, marginBottom: 12, borderRadius: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="loading-skeleton" style={{ height: 34, width: 80, borderRadius: 20, flexShrink: 0 }} />
        ))}
      </div>
      <div className="product-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="loading-skeleton" style={{ height: 200, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
