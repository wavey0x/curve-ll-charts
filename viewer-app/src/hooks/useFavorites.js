import { useState, useEffect } from 'react';

const FAVORITES_KEY = 'curve_gauge_favorites';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem(FAVORITES_KEY);
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error loading favorites from localStorage:', error);
        setFavorites([]);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save favorites to localStorage whenever favorites change (but only after initialization)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  }, [favorites, isInitialized]);

  const addFavorite = (gaugeData) => {
    const newFavorite = {
      id: gaugeData.data.gauge_address,
      gauge_address: gaugeData.data.gauge_address,
      pool_address: gaugeData.data.pool_address,
      pool_name: gaugeData.data.pool_name || 'Unknown Pool',
      pool_url: gaugeData.data.pool_urls?.deposit || '',
      blockchain: gaugeData.data.blockchain || 'Ethereum',
      added_at: new Date().toISOString(),
    };

    setFavorites((prev) => {
      // Check if already exists
      const exists = prev.find((fav) => fav.id === newFavorite.id);
      if (exists) return prev;

      return [...prev, newFavorite];
    });
  };

  const removeFavorite = (gaugeAddress) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== gaugeAddress));
  };

  const isFavorite = (gaugeAddress) => {
    return favorites.some((fav) => fav.id === gaugeAddress);
  };

  const toggleFavorite = (gaugeData) => {
    if (isFavorite(gaugeData.data.gauge_address)) {
      removeFavorite(gaugeData.data.gauge_address);
    } else {
      addFavorite(gaugeData);
    }
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    clearFavorites,
  };
};
