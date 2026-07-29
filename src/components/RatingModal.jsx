import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export default function RatingModal({ order, onClose, onSubmitted }) {
  const { showToast } = useApp();
  const items = order?.order_items || [];

  const [itemRatings, setItemRatings] = useState(() => {
    const initial = {};
    items.forEach((it, idx) => {
      const key = it.menu_item_id || it.item_name || `item-${idx}`;
      initial[key] = { rating: 5, feedback: '' };
    });
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStarClick = (itemKey, star) => {
    setItemRatings((prev) => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], rating: star },
    }));
  };

  const handleFeedbackChange = (itemKey, text) => {
    setItemRatings((prev) => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], feedback: text },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const entries = items.map((it, idx) => {
        const key = it.menu_item_id || it.item_name || `item-${idx}`;
        const ratingData = itemRatings[key] || { rating: 5, feedback: '' };
        return {
          order_id: order.id,
          menu_item_id: it.menu_item_id || null,
          item_name: it.item_name,
          rating: ratingData.rating,
          feedback: ratingData.feedback.trim() || null,
        };
      });

      const { error } = await supabase.from('item_ratings').insert(entries);
      if (error) {
        console.warn('[RatingModal] insert error:', error);
      }

      localStorage.setItem(`rated_order_${order.id}`, 'true');

      showToast('Thank you for your rating & feedback! ⭐', 'var(--color-success)');
      if (onSubmitted) onSubmitted();
      onClose();
    } catch (err) {
      console.error('[RatingModal] error:', err);
      localStorage.setItem(`rated_order_${order.id}`, 'true');
      if (onSubmitted) onSubmitted();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        display: 'flex',
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet"
        style={{
          maxWidth: '460px',
          margin: 'auto',
          borderRadius: '20px',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#181824',
          border: '1px solid #2d2d3f',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 4 }}>🍕⭐</div>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: '0 0 4px 0' }}>How was your meal?</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            Order #{order.order_number} · Table {order.table_number}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          {items.map((it, idx) => {
            const key = it.menu_item_id || it.item_name || `item-${idx}`;
            const currentRating = itemRatings[key]?.rating || 5;
            const currentFeedback = itemRatings[key]?.feedback || '';

            return (
              <div
                key={key}
                style={{
                  backgroundColor: '#0f0f17',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid #29293d',
                }}
              >
                <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: 8 }}>
                  {it.item_name} {it.selected_size ? `(${it.selected_size})` : ''}
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(key, star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 24,
                        cursor: 'pointer',
                        color: star <= currentRating ? '#F59E0B' : '#3F3F46',
                        transition: 'transform 0.15s ease',
                        padding: 0,
                      }}
                    >
                      ★
                    </button>
                  ))}
                  <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700, marginLeft: 4 }}>
                    {currentRating}/5
                  </span>
                </div>

                {/* Feedback text input */}
                <input
                  type="text"
                  placeholder="Optional feedback..."
                  value={currentFeedback}
                  onChange={(e) => handleFeedbackChange(key, e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#181824',
                    border: '1px solid #3F3F5A',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ flex: 1, margin: 0, backgroundColor: 'transparent', border: '1px solid #3F3F5A' }}
          >
            Skip
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ flex: 2, margin: 0 }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Rating ⭐'}
          </button>
        </div>
      </div>
    </div>
  );
}
