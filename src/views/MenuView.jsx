import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useMenu } from '../hooks/useMenu';
import ProductModal from '../components/ProductModal';
import { triggerFlyToCartAnimation } from '../utils/animations';

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

export default function MenuView({ onNavigate, search = '', onSearchChange }) {
  const { lang, getItemName, getItemDesc, getCatName, t, cartCount } = useApp();
  const { categories, itemsByCategory, ratingsMap, loading, error } = useMenu();

  const [activeCategory, setActiveCategory] = useState('all');
  const [modalItem, setModalItem] = useState(null);
  const categoryScrollRef = useRef(null);

  // Items for current category + filtering
  const displayItems = useMemo(() => {
    let items = [];

    if (search.trim()) {
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

    // Default Sorting (Popular first)
    return items.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return 0;
    });
  }, [activeCategory, itemsByCategory, search, getItemName, getItemDesc]);

  const selectCategory = (id) => {
    setActiveCategory(id);
    if (onSearchChange) onSearchChange('');
  };

  if (loading) return <MenuSkeleton />;
  if (error) return (
    <div className="flex flex-col items-center justify-center p-10 text-red-500">
      <i className="fa-solid fa-circle-exclamation text-4xl mb-3" />
      <p className="font-bold">Failed to load menu</p>
      <p className="text-xs text-gray-400 mt-1">{error}</p>
    </div>
  );

  return (
    <div className="w-full flex-1 overflow-y-auto hide-scrollbar px-5 pb-32 pt-2 z-10 relative">
      
      {/* Typography Hero Header */}
      <div className="mb-6">
        <p className="text-gray-300 text-sm font-medium mb-1">Hi, Foodie 👋</p>
        <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
          Good Food<br />
          Good <span className="text-orange-500">Mood!</span>
        </h1>
      </div>

      {/* Category Horizontal Row */}
      <div className="mb-8">
        <div 
          className="flex overflow-x-auto gap-4 py-2 hide-scrollbar snap-x"
          ref={categoryScrollRef}
        >
          <div
            className={`snap-start flex flex-col items-center justify-center min-w-[72px] h-[90px] rounded-[24px] cursor-pointer transition-all duration-300 flex-shrink-0 ${
              activeCategory === 'all' 
                ? 'bg-orange-500/20 border border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                : 'glass-card border-transparent'
            }`}
            onClick={() => selectCategory('all')}
          >
            <div className="w-10 h-10 mb-1 rounded-full bg-white/10 flex items-center justify-center text-lg">🍔</div>
            <span className={`text-[11px] font-bold ${activeCategory === 'all' ? 'text-white' : 'text-gray-400'}`}>
              All
            </span>
          </div>

          {categories
            .filter((cat) => !cat.name?.toLowerCase().includes('fasting') && !cat.name_am?.includes('ጾም'))
            .map((cat) => {
              const isActive = cat.id === activeCategory;
              // Mock icons based on name
              let icon = '🍕';
              if (cat.name?.toLowerCase().includes('burger')) icon = '🍔';
              if (cat.name?.toLowerCase().includes('chicken')) icon = '🍗';
              if (cat.name?.toLowerCase().includes('drink')) icon = '🥤';
              if (cat.name?.toLowerCase().includes('fries')) icon = '🍟';
              if (cat.name?.toLowerCase().includes('salad')) icon = '🥗';
              
              return (
                <div
                  key={cat.id}
                  className={`snap-start flex flex-col items-center justify-center min-w-[72px] h-[90px] rounded-[24px] cursor-pointer transition-all duration-300 flex-shrink-0 ${
                    isActive 
                      ? 'bg-orange-500/20 border border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                      : 'glass-card border-transparent'
                  }`}
                  onClick={() => selectCategory(cat.id)}
                >
                  <div className="w-10 h-10 mb-1 rounded-full bg-white/10 flex items-center justify-center text-lg">{icon}</div>
                  <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {getCatName(cat)}
                  </span>
                </div>
              );
          })}
        </div>
      </div>

      {/* Hero Banner (Mocked) */}
      {activeCategory === 'all' && !search && (
        <div className="w-full glass-panel rounded-[32px] p-5 mb-8 relative overflow-hidden flex items-center justify-between">
          <div className="z-10 w-3/5">
            <div className="text-orange-500 text-xs font-bold mb-1 flex items-center gap-1">
              <i className="fa-solid fa-fire text-orange-500"></i> Limited Time Offer
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-3">
              Spicy Burger<br/><span className="text-gray-300">Combo</span>
            </h2>
            <button className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-5 rounded-full shadow-[0_4px_15px_rgba(249,115,22,0.4)] transition-all">
              Order Now
            </button>
          </div>
          <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[160px] h-[160px]">
             <img src="/pizza-placeholder.jpg" alt="Combo" className="w-full h-full object-cover rounded-full" />
             <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded-full w-12 h-12 flex flex-col items-center justify-center border border-white/20">
                <span className="text-white text-xs font-bold leading-none">20%</span>
                <span className="text-gray-300 text-[9px] leading-none">OFF</span>
             </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-lg font-bold">
          {search.trim() ? `Results for "${search}"` : 'Popular Now'}
        </h2>
        {!search && <span className="text-gray-400 text-xs cursor-pointer hover:text-white transition-colors">View All</span>}
      </div>

      {/* Product Grid */}
      {displayItems.length === 0 ? (
        <div className="text-center p-10 text-gray-400">
          {t('no_items')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {displayItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              onOpen={setModalItem}
              getItemName={getItemName}
            />
          ))}
        </div>
      )}

      {/* Floating tray button */}
      {cartCount > 0 && (
        <div className="fixed bottom-24 right-5 z-[90]">
          <button
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-5 py-3 shadow-[0_8px_25px_rgba(249,115,22,0.5)] flex items-center gap-3 transition-transform hover:scale-105 border border-white/20"
            onClick={() => onNavigate('cart')}
          >
            <i className="fa-solid fa-basket-shopping text-lg" />
            <span className="font-bold text-sm uppercase tracking-wide">{t('view_tray')}</span>
            <span className="bg-white text-orange-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">
              {cartCount}
            </span>
          </button>
        </div>
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
function ProductCard({ item, onOpen, getItemName }) {
  const { addToCart, showToast } = useApp();

  const isSoldOut = item.inventory_status === 'sold-out';
  const dietIcons = getDietaryIcons(item.dietary_tags || []);

  const displayPrice = item.item_type === 'pizza'
    ? item.prices_json?.medium || item.base_price || item.price || 0
    : item.base_price || item.price || 0;

  const hasSizes = !!item.prices_json && Object.keys(item.prices_json).length > 0;
  const isPizza = item.item_type === 'pizza';
  const hasOptions = hasSizes || isPizza;

  const handlePlusClick = (e) => {
    e.stopPropagation();
    if (isSoldOut) return;

    if (hasOptions) {
      onOpen(item);
    } else {
      const unitPrice = item.base_price || item.price || 0;
      const cartId = `${item.id}-flat-${Date.now()}`;

      addToCart({
        cartId,
        menuItemId: item.id,
        name: getItemName(item),
        nameEn: item.name,
        nameAm: item.name_am || item.name,
        size: null,
        crust: null,
        unitPrice,
        quantity: 1,
        imageUrl: item.image_url || null,
        itemType: item.item_type,
      });
      
      triggerFlyToCartAnimation(e, item.image_url);
      showToast(`${getItemName(item)} added to tray!`, 'var(--color-success)');
    }
  };

  return (
    <div
      className={`glass-card rounded-[28px] p-3 flex flex-col relative overflow-hidden group ${isSoldOut ? 'opacity-50 grayscale pointer-events-none' : ''}`}
      onClick={!isSoldOut ? () => onOpen(item) : undefined}
    >
      {/* Top badges (Dietary / Heart) */}
      <div className="absolute top-4 left-4 z-10 flex gap-1">
        {dietIcons && dietIcons.length > 0 && dietIcons.map((icon, i) => (
          <div key={i} className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-[10px] border border-white/10">
            {icon}
          </div>
        ))}
      </div>
      <div className="absolute top-4 right-4 z-10 text-red-500 opacity-60 group-hover:opacity-100 transition-opacity">
        <i className="fa-solid fa-heart text-sm"></i>
      </div>

      {/* Image */}
      <div className="w-full aspect-square mb-2 overflow-hidden rounded-2xl relative">
        <img
          src={item.image_url || '/pizza-placeholder.jpg'}
          alt={getItemName(item)}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 justify-end px-1 pb-2">
        <h4 className="text-white font-bold text-[13px] leading-tight mb-1 truncate">
          {getItemName(item)}
        </h4>
        
        <div className="flex justify-between items-end mt-1">
          <span className="text-gray-300 text-[10px] font-semibold">Br <span className="text-white text-[13px]">{displayPrice}</span></span>
        </div>
      </div>

      {/* Add Button */}
      {!isSoldOut && (
        <button 
          className="absolute bottom-0 right-0 bg-orange-500 hover:bg-orange-600 text-white w-[42px] h-[42px] flex items-center justify-center rounded-tl-[20px] rounded-br-[28px] transition-colors shadow-[-4px_-4px_10px_rgba(0,0,0,0.1)]"
          onClick={handlePlusClick}
        >
          <i className="fa-solid fa-plus text-sm"></i>
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Loading skeleton
// ──────────────────────────────────────────────
function MenuSkeleton() {
  return (
    <div className="w-full px-5 pt-2 flex flex-col gap-6 animate-pulse z-10 relative">
      <div className="h-16 w-3/4 bg-white/10 rounded-xl"></div>
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-[90px] min-w-[72px] rounded-[24px] bg-white/10"></div>)}
      </div>
      <div className="h-32 w-full bg-white/10 rounded-[32px]"></div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-48 rounded-[28px] bg-white/10"></div>)}
      </div>
    </div>
  );
}
