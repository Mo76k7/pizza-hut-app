import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Fetches categories and menu_items from Supabase.
 * Returns { categories, itemsByCategory, loading, error, refetch }
 */
export function useMenu() {
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [ratingsMap, setRatingsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cats, error: catErr }, { data: items, error: itemErr }] = await Promise.all([
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('menu_items').select('*').order('popular', { ascending: false }),
      ]);
      if (catErr) throw catErr;
      if (itemErr) throw itemErr;

      const fallbackCategories = [
        { id: 'a0ee1c23-1111-2222-3333-444444444441', name: 'Veg Pizza', display_order: 1 },
        { id: 'a0ee1c23-1111-2222-3333-444444444442', name: 'Meat Pizza', display_order: 2 },
        { id: 'a0ee1c23-1111-2222-3333-444444444443', name: 'Chicken Pizza', display_order: 3 },
        { id: 'a0ee1c23-1111-2222-3333-444444444444', name: 'Fasting Pizza', display_order: 4 },
        { id: 'a0ee1c23-1111-2222-3333-444444444445', name: 'Sides & Pasta', display_order: 5 },
        { id: 'a0ee1c23-1111-2222-3333-444444444446', name: 'Specials & Melts', display_order: 6 },
        { id: 'a0ee1c23-1111-2222-3333-444444444447', name: 'Drinks', display_order: 7 }
      ];

      const resolvedCats = cats && cats.length > 0 ? cats : fallbackCategories;
      setCategories(resolvedCats);

      // Group items by category_id
      const grouped = {};
      (cats || []).forEach((cat) => { grouped[cat.id] = []; });
      (items || []).forEach((item) => {
        if (!grouped[item.category_id]) {
          grouped[item.category_id] = [];
        }
        grouped[item.category_id].push(item);
      });
      setItemsByCategory(grouped);

      // Fetch item ratings safely
      try {
        let { data: ratingsData, error: ratingsError } = await supabase
          .from('item_ratings')
          .select('menu_item_id, item_name, rating');

        if (ratingsError) {
          ratingsData = [];
        }

        if (ratingsData && Array.isArray(ratingsData)) {
          const map = {};
          ratingsData.forEach((r) => {
            const itemIdKey = r.menu_item_id;
            const itemNameKey = r.item_name;

            if (itemIdKey) {
              if (!map[itemIdKey]) map[itemIdKey] = { sum: 0, count: 0 };
              map[itemIdKey].sum += Number(r.rating || 0);
              map[itemIdKey].count += 1;
            }
            if (itemNameKey && itemNameKey !== itemIdKey) {
              if (!map[itemNameKey]) map[itemNameKey] = { sum: 0, count: 0 };
              map[itemNameKey].sum += Number(r.rating || 0);
              map[itemNameKey].count += 1;
            }
          });
          setRatingsMap(map);
        }
      } catch (rErr) {
        console.warn('[useMenu] ratings fetch warning:', rErr);
      }
    } catch (e) {
      console.error('[useMenu]', e);
      setError(e.message || 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, []);

  const addMenuItem = async (itemData) => {
    const { error } = await supabase.from('menu_items').insert(itemData);
    if (error) throw error;
    await fetchMenu();
  };

  const updateMenuItem = async (id, itemData) => {
    const { error } = await supabase.from('menu_items').update(itemData).eq('id', id);
    if (error) throw error;
    await fetchMenu();
  };

  const deleteMenuItem = async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
    await fetchMenu();
  };

  useEffect(() => {
    fetchMenu();

    const channel = supabase
      .channel('menu-items-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMenu]);

  return { 
    categories, itemsByCategory, ratingsMap, loading, error, refetch: fetchMenu,
    addMenuItem, updateMenuItem, deleteMenuItem 
  };
}
