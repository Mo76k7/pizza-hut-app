import React, { useState, useEffect } from 'react';
import { useMenu } from '../hooks/useMenu';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';

export default function AdminMenuPanel() {
  const { categories, itemsByCategory, loading, error, addMenuItem, updateMenuItem, deleteMenuItem } = useMenu();
  const { t, getCatName, getItemName, showToast } = useApp();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalCategories, setModalCategories] = useState([]);

  useEffect(() => {
    if (modalOpen) {
      supabase.from('categories').select('id, name').then(({ data, error }) => {
        if (!error && data) {
          setModalCategories(data);
        }
      });
    }
  }, [modalOpen]);

  const fallbackCategories = [
    { id: 'a0ee1c23-1111-2222-3333-444444444441', name: 'Veg Pizza' },
    { id: 'a0ee1c23-1111-2222-3333-444444444442', name: 'Meat Pizza' },
    { id: 'a0ee1c23-1111-2222-3333-444444444443', name: 'Chicken Pizza' },
    { id: 'a0ee1c23-1111-2222-3333-444444444444', name: 'Fasting Pizza' },
    { id: 'a0ee1c23-1111-2222-3333-444444444445', name: 'Sides & Pasta' },
    { id: 'a0ee1c23-1111-2222-3333-444444444446', name: 'Specials & Melts' },
    { id: 'a0ee1c23-1111-2222-3333-444444444447', name: 'Drinks' }
  ];
  
  const displayCategories = modalCategories.length > 0 ? modalCategories : fallbackCategories;
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    name_am: '',
    description_am: '',
    base_price: '',
    hasMultipleSizes: false,
    price_small: '',
    price_medium: '',
    price_large: '',
    image_url: '',
    inventory_status: 'available',
    category_id: '',
    popular: false,
    dietary_tags: []
  });

  const handleEdit = (item, catId) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      name_am: item.name_am || '',
      description_am: item.description_am || '',
      base_price: item.base_price || '',
      hasMultipleSizes: !!item.prices_json && Object.keys(item.prices_json).length > 0,
      price_small: item.prices_json?.small || '',
      price_medium: item.prices_json?.medium || '',
      price_large: item.prices_json?.large || '',
      image_url: item.image_url || '',
      inventory_status: item.inventory_status || 'available',
      category_id: item.category_id || catId,
      popular: item.popular || false,
      dietary_tags: item.dietary_tags || []
    });
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '', description: '', name_am: '', description_am: '',
      base_price: '', hasMultipleSizes: false, price_small: '', price_medium: '', price_large: '', 
      image_url: '', inventory_status: 'available',
      category_id: '', popular: false, dietary_tags: []
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const isSizesOn = formData.hasMultipleSizes;
    if (!formData.name.trim() || !formData.category_id) {
      showToast('Please fill in required fields (Name, Category)', 'var(--color-error)');
      return;
    }
    if (!isSizesOn && formData.base_price === '') {
      showToast('Please provide a Base Price', 'var(--color-error)');
      return;
    }
    if (isSizesOn && (formData.price_small === '' || formData.price_medium === '' || formData.price_large === '')) {
      showToast('Please fill in all size prices', 'var(--color-error)');
      return;
    }

    const payload = {
      ...formData,
      base_price: isSizesOn ? parseFloat(formData.price_medium) : parseFloat(formData.base_price),
      prices_json: isSizesOn ? {
        small: parseFloat(formData.price_small),
        medium: parseFloat(formData.price_medium),
        large: parseFloat(formData.price_large)
      } : null
    };

    delete payload.hasMultipleSizes;
    delete payload.price_small;
    delete payload.price_medium;
    delete payload.price_large;

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        showToast('Item updated successfully!');
      } else {
        await addMenuItem(payload);
        showToast('Item added successfully!');
      }
      setModalOpen(false);
    } catch (e) {
      showToast(`Error: ${e.message}`, 'var(--color-error)');
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteMenuItem(editingItem.id);
      showToast('Item deleted!');
      setModalOpen(false);
    } catch (e) {
      showToast(`Error: ${e.message}`, 'var(--color-error)');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}>Loading menu...</div>;
  if (error) return <div style={{ color: 'var(--color-error)' }}>Error: {error}</div>;

  return (
    <div id="admin-menu-panel">
      <button className="btn-secondary" onClick={handleAdd} style={{ width: 'auto', padding: '6px 14px', display: 'inline-flex', marginBottom: 10 }}>
        <i className="fa-solid fa-plus" /> Add Item
      </button>

      <div id="admin-menu-list">
        {categories.map((cat) => {
          const items = itemsByCategory[cat.id] || [];
          if (items.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 16 }}>
              <h3 style={{ color: 'var(--color-accent)', fontSize: 'clamp(12px, 2.5vw, 14px)', textTransform: 'uppercase', marginBottom: 6 }}>
                {getCatName(cat)}
              </h3>
              {items.map((item) => {
                const statusClass = 
                  item.inventory_status === 'available' ? 'available' :
                  item.inventory_status === 'limited' ? 'limited' : 'sold-out';
                const statusLabel = 
                  item.inventory_status === 'available' ? '✅ Available' :
                  item.inventory_status === 'limited' ? '⚠️ Limited' : '❌ Sold Out';

                return (
                  <div key={item.id} className="admin-item-card" onClick={() => handleEdit(item, cat.id)}>
                    <img src={item.image_url} alt={item.name} />
                    <div className="info">
                      <h4>{getItemName(item)}</h4>
                      <p>Br {item.base_price}</p>
                    </div>
                    <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => { if(e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="modal-sheet" style={{ transform: 'none', animation: 'none' }}>
            <div className="modal-drag-handle" />
            <div className="modal-close-header">
              <h3 className="display-title" style={{ fontSize: 'clamp(16px,4vw,20px)' }}>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input 
                type="text" placeholder="Item Name (EN) *" required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
              />
              <input 
                type="text" placeholder="Item Name (Amharic)"
                value={formData.name_am} onChange={e => setFormData({...formData, name_am: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
              />
              <textarea 
                placeholder="Description (EN)"
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', resize: 'none', height: 60 }} 
              />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input 
                  type="checkbox" id="sizes-chk"
                  checked={formData.hasMultipleSizes} onChange={e => setFormData({...formData, hasMultipleSizes: e.target.checked})}
                />
                <label htmlFor="sizes-chk">Has Multiple Sizes?</label>
              </div>

              {!formData.hasMultipleSizes ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    type="number" placeholder="Base Price *" required
                    value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                  />
                  <input 
                    type="text" placeholder="Image URL"
                    value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})}
                    style={{ flex: 2, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="number" placeholder="Small Price *" required
                      value={formData.price_small} onChange={e => setFormData({...formData, price_small: e.target.value})}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                    />
                    <input 
                      type="number" placeholder="Medium Price *" required
                      value={formData.price_medium} onChange={e => setFormData({...formData, price_medium: e.target.value})}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                    />
                    <input 
                      type="number" placeholder="Large Price *" required
                      value={formData.price_large} onChange={e => setFormData({...formData, price_large: e.target.value})}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                    />
                  </div>
                  <input 
                    type="text" placeholder="Image URL"
                    value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }} 
                  />
                </div>
              )}

              <select 
                value={formData.inventory_status} onChange={e => setFormData({...formData, inventory_status: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }}>
                <option value="available" style={{ color: '#ffffff', backgroundColor: '#1e1e2d' }}>Available</option>
                <option value="limited" style={{ color: '#ffffff', backgroundColor: '#1e1e2d' }}>Limited</option>
                <option value="sold-out" style={{ color: '#ffffff', backgroundColor: '#1e1e2d' }}>Sold Out</option>
              </select>

              <select 
                value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#FFF', padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' }}>
                <option value="" disabled style={{ color: '#ffffff', backgroundColor: '#1a1a2e' }}>Select a Category...</option>
                {displayCategories.map(c => <option key={c.id} value={c.id} style={{ color: '#ffffff', backgroundColor: '#1a1a2e' }}>{c.name}</option>)}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="checkbox" id="popular-chk"
                  checked={formData.popular} onChange={e => setFormData({...formData, popular: e.target.checked})}
                />
                <label htmlFor="popular-chk">Mark as Popular (★)</label>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-primary" onClick={handleSave} style={{ margin: 0, flex: 1 }}>Save</button>
                {editingItem && (
                  <button className="btn-secondary" onClick={handleDelete} style={{ margin: 0, flex: 0.5, background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)', color: 'var(--color-error)' }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
