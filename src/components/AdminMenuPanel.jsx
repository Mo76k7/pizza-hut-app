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
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      supabase.from('categories').select('id, name').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
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
    { id: 'a0ee1c23-1111-2222-3333-444444444447', name: 'Drinks' },
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
    dietary_tags: [],
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
      dietary_tags: item.dietary_tags || [],
    });
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
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
      category_id: displayCategories[0]?.id || '',
      popular: false,
      dietary_tags: [],
    });
    setModalOpen(true);
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `menu-items/${fileName}`;

      // Upload file to 'menu-images' bucket in Supabase Storage
      const { data, error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(filePath, file);

      if (uploadErr) {
        console.warn('Bucket upload error, setting preview:', uploadErr);
        // Fallback local preview URL
        const localPreview = URL.createObjectURL(file);
        setFormData((prev) => ({ ...prev, image_url: localPreview }));
        showToast('Image preview set locally.', 'var(--color-warning)');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: urlData.publicUrl }));
      showToast('Image uploaded to Supabase Storage!', 'var(--color-success)');
    } catch (err) {
      console.error('[AdminMenuPanel] upload error:', err);
      showToast('Failed to upload image', 'var(--color-error)');
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleStockStatus = async (e, item) => {
    e.stopPropagation();
    const nextStatus = item.inventory_status === 'available' ? 'sold-out' : 'available';
    try {
      await updateMenuItem(item.id, { inventory_status: nextStatus });
      showToast(
        `${item.name} is now ${nextStatus === 'available' ? 'In Stock (Available)' : 'Out of Stock (Sold Out)'}!`,
        nextStatus === 'available' ? 'var(--color-success)' : 'var(--color-error)'
      );
    } catch (err) {
      showToast(`Error updating stock: ${err.message}`, 'var(--color-error)');
    }
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
      showToast('Please fill in all size prices (Small, Medium, Large)', 'var(--color-error)');
      return;
    }

    const payload = {
      ...formData,
      base_price: isSizesOn ? parseFloat(formData.price_medium) : parseFloat(formData.base_price),
      item_type: isSizesOn ? 'pizza' : 'item',
      prices_json: isSizesOn
        ? {
            small: parseFloat(formData.price_small),
            medium: parseFloat(formData.price_medium),
            large: parseFloat(formData.price_large),
          }
        : null,
    };

    delete payload.hasMultipleSizes;
    delete payload.price_small;
    delete payload.price_medium;
    delete payload.price_large;

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        showToast('Item updated successfully!', 'var(--color-success)');
      } else {
        await addMenuItem(payload);
        showToast('Item added successfully!', 'var(--color-success)');
      }
      setModalOpen(false);
    } catch (e) {
      showToast(`Error saving item: ${e.message}`, 'var(--color-error)');
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    if (!window.confirm(`Are you sure you want to delete "${editingItem.name}"?`)) return;
    try {
      await deleteMenuItem(editingItem.id);
      showToast('Item deleted successfully!', 'var(--color-success)');
      setModalOpen(false);
    } catch (e) {
      showToast(`Error deleting item: ${e.message}`, 'var(--color-error)');
    }
  };

  const isFasting = (formData.dietary_tags || []).includes('fasting');
  const toggleFastingTag = (checked) => {
    let tags = [...(formData.dietary_tags || [])];
    if (checked) {
      if (!tags.includes('fasting')) tags.push('fasting');
    } else {
      tags = tags.filter((t) => t !== 'fasting');
    }
    setFormData({ ...formData, dietary_tags: tags });
  };

  const isSpicy = (formData.dietary_tags || []).includes('spicy');
  const toggleSpicyTag = (checked) => {
    let tags = [...(formData.dietary_tags || [])];
    if (checked) {
      if (!tags.includes('spicy')) tags.push('spicy');
    } else {
      tags = tags.filter((t) => t !== 'spicy');
    }
    setFormData({ ...formData, dietary_tags: tags });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}>Loading menu...</div>;
  if (error) return <div style={{ color: 'var(--color-error)' }}>Error: {error}</div>;

  return (
    <div id="admin-menu-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button
          className="btn-primary"
          onClick={handleAdd}
          style={{ width: 'auto', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}
        >
          <i className="fa-solid fa-plus" /> Add New Item
        </button>
      </div>

      <div id="admin-menu-list">
        {categories.map((cat) => {
          const items = itemsByCategory[cat.id] || [];
          if (items.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 20 }}>
              <h3
                style={{
                  color: 'var(--color-accent)',
                  fontSize: 'clamp(13px, 2.5vw, 15px)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  borderBottom: '1px solid var(--glass-border)',
                  paddingBottom: 4,
                }}
              >
                {getCatName(cat)} ({items.length})
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {items.map((item) => {
                  const isAvailable = item.inventory_status === 'available';
                  const isLimited = item.inventory_status === 'limited';

                  const statusClass = isAvailable ? 'available' : isLimited ? 'limited' : 'sold-out';
                  const statusLabel = isAvailable ? '✅ In Stock' : isLimited ? '⚠️ Limited' : '❌ Out of Stock';

                  return (
                    <div
                      key={item.id}
                      className="admin-item-card"
                      onClick={() => handleEdit(item, cat.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        backgroundColor: '#181824',
                        border: '1px solid #2d2d3f',
                        borderRadius: 10,
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <img
                        src={item.image_url || '/pizza-placeholder.jpg'}
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = '/pizza-placeholder.jpg';
                        }}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
                      />
                      <div className="info" style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getItemName(item)}
                        </h4>
                        <p style={{ margin: '2px 0 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
                          {item.prices_json
                            ? `Br ${item.prices_json.small || item.base_price} – ${item.prices_json.large || item.base_price}`
                            : `Br ${item.base_price}`}
                        </p>
                      </div>

                      {/* Stock Toggle Button directly on card */}
                      <button
                        type="button"
                        onClick={(e) => toggleStockStatus(e, item)}
                        title="Click to toggle stock status"
                        style={{
                          backgroundColor: isAvailable ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isAvailable ? '#22c55e' : '#ef4444',
                          border: `1px solid ${isAvailable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Item Modal */}
      {modalOpen && (
        <div
          className="modal-overlay"
          style={{ display: 'flex', zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="modal-sheet"
            style={{
              maxWidth: '520px',
              margin: 'auto',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#181824',
              border: '1px solid #2d2d3f',
              borderRadius: 16,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-close-header" style={{ marginBottom: 16 }}>
              <h3 className="display-title" style={{ fontSize: 'clamp(18px,4vw,22px)', margin: 0 }}>
                {editingItem ? '✏️ Edit Menu Item' : '➕ Add New Menu Item'}
              </h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Name EN */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>
                  Item Name (English) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Super Supreme Pizza"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Name Amharic */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  Item Name (Amharic Optional)
                </label>
                <input
                  type="text"
                  placeholder="ለምሳሌ፦ ሱፐር ሱፕሪም ፒዛ"
                  value={formData.name_am}
                  onChange={(e) => setFormData({ ...formData, name_am: e.target.value })}
                  style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Category Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>
                  Category *
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="" disabled style={{ color: '#fff', backgroundColor: '#181824' }}>Select a Category...</option>
                  {displayCategories.map((c) => (
                    <option key={c.id} value={c.id} style={{ color: '#fff', backgroundColor: '#181824' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>
                  Description (Ingredients)
                </label>
                <textarea
                  placeholder="Tomato Sauce, Mozzarella Cheese, Beef..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', resize: 'none', height: 60, boxSizing: 'border-box' }}
                />
              </div>

              {/* Pricing mode toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="sizes-chk"
                  checked={formData.hasMultipleSizes}
                  onChange={(e) => setFormData({ ...formData, hasMultipleSizes: e.target.checked })}
                />
                <label htmlFor="sizes-chk" style={{ color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  Multiple Sizes (Small / Medium / Large Pizza Pricing)
                </label>
              </div>

              {/* Price Fields */}
              {!formData.hasMultipleSizes ? (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>
                    Price (Br) *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 355"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Small Price</label>
                    <input
                      type="number"
                      placeholder="e.g. 540"
                      value={formData.price_small}
                      onChange={(e) => setFormData({ ...formData, price_small: e.target.value })}
                      style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 8, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Medium Price</label>
                    <input
                      type="number"
                      placeholder="e.g. 830"
                      value={formData.price_medium}
                      onChange={(e) => setFormData({ ...formData, price_medium: e.target.value })}
                      style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 8, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Large Price</label>
                    <input
                      type="number"
                      placeholder="e.g. 1245"
                      value={formData.price_large}
                      onChange={(e) => setFormData({ ...formData, price_large: e.target.value })}
                      style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 8, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {/* Image Upload section */}
              <div style={{ backgroundColor: '#0f0f17', padding: 12, borderRadius: 8, border: '1px solid #29293d' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 6, fontWeight: 600 }}>
                  Item Image (Upload File to Supabase Storage)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  disabled={uploadingImage}
                  style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}
                />
                {uploadingImage && <div style={{ color: 'var(--color-accent)', fontSize: 12 }}>Uploading image to menu-images bucket...</div>}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Or enter direct Image URL..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    style={{ flex: 1, background: '#181824', border: '1px solid #3f3f5a', color: '#FFF', padding: 8, borderRadius: 6, fontSize: 12, outline: 'none' }}
                  />
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid #3f3f5a' }}
                      onError={(e) => { e.target.src = '/pizza-placeholder.jpg'; }}
                    />
                  )}
                </div>
              </div>

              {/* Stock Status Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>
                  Stock Status
                </label>
                <select
                  value={formData.inventory_status}
                  onChange={(e) => setFormData({ ...formData, inventory_status: e.target.value })}
                  style={{ width: '100%', background: '#0f0f17', border: '1px solid #3f3f5a', color: '#FFF', padding: 10, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="available" style={{ color: '#fff', backgroundColor: '#181824' }}>✅ In Stock (Available)</option>
                  <option value="limited" style={{ color: '#fff', backgroundColor: '#181824' }}>⚠️ Limited Stock</option>
                  <option value="sold-out" style={{ color: '#fff', backgroundColor: '#181824' }}>❌ Out of Stock (Sold Out)</option>
                </select>
              </div>

              {/* Fasting & Spicy & Popular Toggles */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isFasting}
                    onChange={(e) => toggleFastingTag(e.target.checked)}
                  />
                  ✝️ Fasting Food
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isSpicy}
                    onChange={(e) => toggleSpicyTag(e.target.checked)}
                  />
                  🌶️ Spicy
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                  />
                  ★ Popular Pick
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  style={{ margin: 0, flex: 2, padding: 12 }}
                >
                  {editingItem ? 'Save Changes' : 'Add Item to Menu'}
                </button>
                {editingItem && (
                  <button
                    className="btn-secondary"
                    onClick={handleDelete}
                    style={{
                      margin: 0,
                      flex: 1,
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: 12,
                    }}
                  >
                    Delete Item
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
