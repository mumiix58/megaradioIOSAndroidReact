// CarPlayHandler - Initializes CarPlay & Android Auto integration
// Must be rendered inside AudioProvider

import { useEffect, useRef } from 'react';
import { Platform, NativeModules } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CarPlayService from '../services/carPlayService';
import stationService from '../services/stationService';
import userService from '../services/userService';
import genreService from '../services/genreService';
import { useFavoritesStore } from '../store/favoritesStore';
import { useLocationStore } from '../store/locationStore';
import useRecentlyPlayedStore from '../store/recentlyPlayedStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import type { Station } from '../types';
import { getStationStreamUrl } from '../utils/streamSources';
import { useLanguageStore } from '../store/languageStore';
import i18n from '../services/i18nService';

// Android Auto Native Module
const { AndroidAutoModule } = NativeModules;

// Track last values to detect changes (module-level for persistence)
let lastCountry: string | null = null;
let lastFavoritesCount: number = -1; // -1 to detect first load
let lastRecentCount: number = -1; // -1 to detect first load
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isRefreshing: boolean = false; // Prevent concurrent refreshes (crash fix)

// API wrapper functions for CarPlay
const getPopularStations = async (): Promise<Station[]> => {
  try {
    // Get selected country from location store
    // Use English country name (e.g., "Austria") for API compatibility
    const { countryEnglish, country } = useLocationStore.getState();
    const selectedCountry = countryEnglish || country || undefined;
    
    console.log('[CarPlayHandler] Fetching popular stations for country:', selectedCountry);
    
    // Use getPopularStations with explicit limit=50 for CarPlay
    const response = await stationService.getPopularStations(selectedCountry, 50);
    
    console.log('[CarPlayHandler] Got', response.stations?.length || 0, 'popular stations for CarPlay');
    
    // Log first few stations for debugging
    if (response.stations && response.stations.length > 0) {
      console.log('[CarPlayHandler] First 3 stations:', 
        response.stations.slice(0, 3).map(s => s.name).join(', '));
    }
    
    return response.stations || [];
  } catch (error) {
    console.error('[CarPlayHandler] Error fetching stations:', error);
    return [];
  }
};

const getFavoriteStations = async (): Promise<Station[]> => {
  try {
    const store = useFavoritesStore.getState();
    
    // PERFORMANCE FIX: Return local favorites immediately, don't block on server sync
    // This prevents CarPlay from waiting for network requests
    if (store.favorites.length > 0) {
      console.log('[CarPlayHandler] Returning cached favorites immediately:', store.favorites.length);
      
      // Sync in background (non-blocking) for next time
      if (!store.isLoaded) {
        store.syncWithServer().catch(() => {
          store.loadLocalFavorites().catch(() => {});
        });
      }
      
      return store.favorites;
    }
    
    // No cached favorites - try local storage first (fast)
    console.log('[CarPlayHandler] No cached favorites, trying local storage...');
    try {
      await store.loadLocalFavorites();
      const localFavorites = useFavoritesStore.getState().favorites;
      if (localFavorites.length > 0) {
        console.log('[CarPlayHandler] Loaded', localFavorites.length, 'favorites from local storage');
        // Background sync for freshness
        store.syncWithServer().catch(() => {});
        return localFavorites;
      }
    } catch (e) {
      console.log('[CarPlayHandler] Local favorites load failed');
    }
    
    // Last resort - quick server sync with timeout
    console.log('[CarPlayHandler] Attempting quick server sync...');
    try {
      // Give server sync max 2 seconds, then return empty
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 2000)
      );
      await Promise.race([store.syncWithServer(), timeoutPromise]);
    } catch (e) {
      console.log('[CarPlayHandler] Server sync timed out or failed');
    }
    
    const favorites = useFavoritesStore.getState().favorites;
    console.log('[CarPlayHandler] Returning', favorites?.length || 0, 'favorites');
    return favorites || [];
  } catch (error) {
    console.error('[CarPlayHandler] Error fetching favorites:', error);
    return [];
  }
};

const getRecentStations = async (): Promise<Station[]> => {
  try {
    // First try local store (fast, works without auth)
    let localStations: Station[] = [];
    try {
      const recentlyPlayedStore = require('../store/recentlyPlayedStore').default;
      localStations = recentlyPlayedStore.getState()?.stations || [];
      console.log('[CarPlayHandler] Local recently played:', localStations.length);
    } catch {
      // Ignore store errors
    }
    
    // Then try API (might fail if not authenticated)
    try {
      const response = await userService.getRecentlyPlayed();
      const apiStations = response || [];
      console.log('[CarPlayHandler] API recently played:', apiStations.length);
      
      // Use API data if available, otherwise local
      if (apiStations.length > 0) return apiStations;
    } catch (apiError) {
      console.log('[CarPlayHandler] API recently played failed (might not be logged in):', apiError);
    }
    
    return localStations;
  } catch (error) {
    console.error('[CarPlayHandler] Error fetching recent:', error);
    return [];
  }
};

const getGenresList = async (): Promise<{ name: string; count: number }[]> => {
  try {
    // Get selected country code for filtering genres
    // API expects ISO country code (e.g., "TR", "DE") not country name
    const { countryCode, country } = useLocationStore.getState();
    
    console.log('[CarPlayHandler] Fetching genres for countryCode:', countryCode, 'country:', country);
    
    // Use precomputed genres endpoint - faster and cached, limit=40 for CarPlay
    // Pass countryCode for filtered results (API expects ISO code like "TR")
    // COLD START FIX: If no countryCode available, fetch global genres (no country filter)
    const response = await genreService.getPrecomputedGenres(countryCode || undefined, 40);
    
    // Return top 40 genres for CarPlay list
    const genres = (response.data || []).slice(0, 40).map((g: any) => ({
      name: g.name || g.slug || g,
      count: g.stationCount || g.total_stations || g.count || 0,
    }));
    
    console.log('[CarPlayHandler] Got', genres.length, 'genres for CarPlay (countryCode:', countryCode, ')');
    
    // If no genres returned and we had a country filter, try without country filter
    if (genres.length === 0 && countryCode) {
      console.log('[CarPlayHandler] No genres with country filter, trying global...');
      const globalResponse = await genreService.getPrecomputedGenres(undefined, 40);
      const globalGenres = (globalResponse.data || []).slice(0, 40).map((g: any) => ({
        name: g.name || g.slug || g,
        count: g.stationCount || g.total_stations || g.count || 0,
      }));
      console.log('[CarPlayHandler] Got', globalGenres.length, 'global genres (fallback)');
      return globalGenres;
    }
    
    return genres;
  } catch (error) {
    console.error('[CarPlayHandler] Error fetching genres:', error);
    return [];
  }
};

const getStationsByGenre = async (genre: string): Promise<Station[]> => {
  try {
    // Get selected country for filtering
    // Use countryEnglish for genre stations API (expects English name like "Turkey")
    const { countryEnglish, country } = useLocationStore.getState();
    const selectedCountry = countryEnglish || country || undefined;
    
    // Genre slug should be lowercase with hyphens (e.g., "hip-hop", "rock", "pop")
    // DO NOT convert to lowercase if already in correct format from API
    const genreSlug = genre.toLowerCase().replace(/\s+/g, '-');
    
    console.log('[CarPlayHandler] Fetching stations for genre:', genre, '-> slug:', genreSlug, 'country:', selectedCountry);
    
    // Use genreService for better country filtering
    // Pass countryEnglish (e.g., "Turkey") for genre stations API
    const response = await genreService.getGenreStations(genreSlug, 1, 50, selectedCountry);
    
    console.log('[CarPlayHandler] Got', response.stations?.length || 0, 'stations for genre', genre, '(country:', selectedCountry, ')');
    
    // Log first 3 stations for debugging
    if (response.stations && response.stations.length > 0) {
      console.log('[CarPlayHandler] First 3 genre stations:', 
        response.stations.slice(0, 3).map(s => `${s.name} (${s.country})`).join(', '));
    } else {
      console.warn('[CarPlayHandler] NO STATIONS returned for genre:', genre, 'country:', selectedCountry);
    }
    
    return response.stations || [];
  } catch (error) {
    console.error('[CarPlayHandler] Error fetching genre stations:', error);
    return [];
  }
};

// Search stations API wrapper for CarPlay
const searchStations = async (query: string): Promise<Station[]> => {
  try {
    console.log('[CarPlayHandler] Searching stations for query:', query);
    
    const stations = await stationService.searchStations(query, 20);
    
    console.log('[CarPlayHandler] Search returned', stations?.length || 0, 'stations');
    return stations || [];
  } catch (error) {
    console.error('[CarPlayHandler] Error searching stations:', error);
    return [];
  }
};

// AsyncStorage keys - must match AudioProvider.tsx
const SIMILAR_STATIONS_KEY = '@megaradio_similar_stations';
const SIMILAR_INDEX_KEY = '@megaradio_similar_index';
const PLAYBACK_HISTORY_KEY = '@megaradio_playback_history';

// Toggle favorite for a station (CarPlay NowPlaying button callback)
const toggleFavoriteStation = async (station: Station): Promise<void> => {
  try {
    const store = useFavoritesStore.getState();
    console.log('[CarPlayHandler] Toggle favorite for:', station.name);
    await store.toggleFavorite(station);
    console.log('[CarPlayHandler] Favorite toggled successfully');
  } catch (error) {
    console.error('[CarPlayHandler] Error toggling favorite:', error);
  }
};

// Check if station is in favorites
const isStationFavorite = (stationId: string): boolean => {
  const store = useFavoritesStore.getState();
  return store.isFavorite(stationId);
};

// Get next similar station (for CarPlay Up Next button)
const getNextStation = async (): Promise<Station | null> => {
  try {
    const similarJson = await AsyncStorage.getItem(SIMILAR_STATIONS_KEY);
    const similarStations = similarJson ? JSON.parse(similarJson) : [];
    
    if (similarStations.length > 0) {
      const indexJson = await AsyncStorage.getItem(SIMILAR_INDEX_KEY);
      let currentIdx = indexJson ? parseInt(indexJson, 10) : -1;
      currentIdx = (currentIdx + 1) % similarStations.length;
      await AsyncStorage.setItem(SIMILAR_INDEX_KEY, String(currentIdx));
      
      const nextStation = similarStations[currentIdx];
      if (nextStation) {
        console.log('[CarPlayHandler] Next station from similar:', nextStation.name);
        return nextStation;
      }
    }
    
    // Fallback to favorites
    const store = useFavoritesStore.getState();
    if (store.favorites.length > 0) {
      console.log('[CarPlayHandler] Next station from favorites (fallback)');
      return store.favorites[0];
    }
    
    return null;
  } catch (error) {
    console.error('[CarPlayHandler] Error getting next station:', error);
    return null;
  }
};

// Get previous station from playback history
const getPreviousStation = async (): Promise<Station | null> => {
  try {
    const historyJson = await AsyncStorage.getItem(PLAYBACK_HISTORY_KEY);
    const history = historyJson ? JSON.parse(historyJson) : [];
    
    if (history.length >= 2) {
      const previousStation = history[1]; // [0] is current, [1] is previous
      if (previousStation) {
        console.log('[CarPlayHandler] Previous station from history:', previousStation.name);
        // Reset similar index
        await AsyncStorage.setItem(SIMILAR_INDEX_KEY, '-1');
        return previousStation;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CarPlayHandler] Error getting previous station:', error);
    return null;
  }
};

export const CarPlayHandler: React.FC = () => {
  const { playStation, isReady: isAudioReady } = useAudioPlayer();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  
  // Watch favorites, location, and recently played changes
  const favorites = useFavoritesStore(state => state.favorites);
  const { country, countryEnglish } = useLocationStore();
  const recentStations = useRecentlyPlayedStore(state => state.stations);
  const languageVersion = useLanguageStore(state => state.languageVersion);
  
  
  // Debounced refresh function to avoid too many refreshes
  const debouncedRefresh = (reason: string) => {
    // CRASH FIX: Prevent concurrent refreshes which can cause 
    // REASwizzledUIManager race condition with RCTUIManager
    if (isRefreshing) {
      console.log(`[CarPlayHandler] Skipping refresh (already refreshing): ${reason}`);
      return;
    }
    
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }
    
    // Increased debounce to 1000ms to prevent rapid updates causing crash
    refreshDebounceTimer = setTimeout(async () => {
      if (CarPlayService.isConnected && !isRefreshing) {
        console.log(`[CarPlayHandler] Triggering CarPlay refresh: ${reason}`);
        
        isRefreshing = true;
        try {
          await CarPlayService.refreshTemplates?.();
          console.log('[CarPlayHandler] CarPlay refresh completed');
        } catch (err) {
          console.error('[CarPlayHandler] CarPlay refresh failed:', err);
        } finally {
          isRefreshing = false;
        }
      }
    }, 1000);
  };

  // COLD START FIX: Initialize CarPlayService IMMEDIATELY when component mounts
  // Don't wait for playStation - create templates without play capability first.
  // This ensures CarPlay shows real data instead of "Loading..." on cold start.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    console.log('[CarPlayHandler] Component mounted - initializing CarPlay early (without playStation)');

    // Pre-warm the cache in background
    const { country: c, countryEnglish: ce } = useLocationStore.getState();
    Promise.all([
      stationService.getPopularStations(ce || c || undefined, 50).catch(() => {}),
      genreService.getPrecomputedGenres(ce || c || undefined, 40).catch(() => {}),
      useFavoritesStore.getState().loadLocalFavorites().catch(() => {}),
    ]).then(() => {
      console.log('[CarPlayHandler] Cache pre-warmed successfully');
    }).catch(() => {});

    // Initialize with a no-op playStation placeholder
    // Templates will be created and visible, play will work once playStation is available
    const deferredPlayStation = async (station: any) => {
      console.log('[CarPlayHandler] Deferred play - waiting for playStation...');
      
      // Retry up to 20 times (10 seconds total) for cold start scenarios
      // Check BOTH isAudioReady AND playStationRef to ensure real audio provider is ready
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentPlayStation = playStationRef.current;
        const audioReady = isAudioReadyRef.current;
        
        if (audioReady && currentPlayStation) {
          console.log('[CarPlayHandler] playStation + AudioProvider ready after', (attempt + 1) * 500, 'ms');
          return currentPlayStation(station);
        }
      }
      console.warn('[CarPlayHandler] playStation still not available after 10s - giving up');
    };

    try {
      CarPlayService.initialize(
        deferredPlayStation,
        getPopularStations,
        getFavoriteStations,
        getRecentStations,
        getGenresList,
        getStationsByGenre,
        searchStations,
        toggleFavoriteStation,
        isStationFavorite,
        getNextStation,
        getPreviousStation
      );
      initializedRef.current = true;
      console.log('[CarPlayHandler] CarPlayService.initialize completed (early, deferred play)');
    } catch (error: any) {
      console.error('[CarPlayHandler] Error initializing:', error);
    }

    return () => {
      console.log('[CarPlayHandler] Cleaning up CarPlay service');
      if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = null;
      }
      isRefreshing = false;
      initializedRef.current = false;
      CarPlayService.disconnect();
    };
  }, []);

  // Store ref to latest playStation and isReady for deferred play
  const playStationRef = useRef(playStation);
  playStationRef.current = playStation;
  const isAudioReadyRef = useRef(isAudioReady);
  isAudioReadyRef.current = isAudioReady;
  
  // When playStation becomes available, update the callback in CarPlayService
  // and refresh templates so play actually works
  useEffect(() => {
    if (Platform.OS === 'web' || !playStation || !initializedRef.current) return;
    
    console.log('[CarPlayHandler] playStation NOW AVAILABLE - updating CarPlay callbacks');
    
    // Re-initialize with real playStation to update the callback
    try {
      CarPlayService.initialize(
        playStation,
        getPopularStations,
        getFavoriteStations,
        getRecentStations,
        getGenresList,
        getStationsByGenre,
        searchStations,
        toggleFavoriteStation,
        isStationFavorite,
        getNextStation,
        getPreviousStation
      );
      console.log('[CarPlayHandler] CarPlayService re-initialized with real playStation');
      
      // COLD START FIX: If CarPlay is already connected, force a template refresh
      // This ensures playback works even if templates were created with deferred play
      if (CarPlayService.isConnected) {
        console.log('[CarPlayHandler] CarPlay is connected - forcing template refresh with real playStation');
        setTimeout(() => {
          CarPlayService.refreshTemplates?.().catch((err: any) => {
            console.error('[CarPlayHandler] Template refresh error:', err);
          });
        }, 300);
      }
    } catch (error: any) {
      console.error('[CarPlayHandler] Error re-initializing:', error);
    }
  }, [playStation]);
  
  // Watch for country changes - when user changes country, refresh CarPlay stations
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const currentCountry = countryEnglish || country;
    
    // Skip if no country yet, but trigger refresh on FIRST detection AND on changes
    // This ensures genres show per-country counts after location is detected
    if (currentCountry && currentCountry !== lastCountry) {
      if (lastCountry !== null) {
        console.log('[CarPlayHandler] Country changed from', lastCountry, 'to', currentCountry);
      } else {
        console.log('[CarPlayHandler] Country first detected:', currentCountry);
      }
      
      // IMPORTANT: Invalidate React Query cache to prevent showing old country data
      // This fixes the "double loading" issue where global stations appear first
      queryClient.invalidateQueries({ queryKey: ['popularStations'] });
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      console.log('[CarPlayHandler] Invalidated React Query cache for new country');
      
      // Trigger CarPlay template refresh
      debouncedRefresh(`Country changed: ${lastCountry} → ${currentCountry}`);
    }
    
    lastCountry = currentCountry;
  }, [country, countryEnglish, queryClient]);
  
  // Watch for favorites changes - when user adds/removes favorites, update CarPlay
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const currentCount = favorites?.length || 0;
    
    // Skip first load (-1), only trigger on actual changes after initial load
    if (lastFavoritesCount >= 0 && currentCount !== lastFavoritesCount) {
      console.log('[CarPlayHandler] Favorites changed from', lastFavoritesCount, 'to', currentCount);
      
      // Trigger CarPlay template refresh
      debouncedRefresh(`Favorites changed: ${lastFavoritesCount} → ${currentCount}`);
    }
    
    lastFavoritesCount = currentCount;
  }, [favorites]);
  
  // Watch for recently played changes - when user plays a station, update CarPlay
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const currentCount = recentStations?.length || 0;
    
    // Skip first load (-1), only trigger on actual changes after initial load
    if (lastRecentCount >= 0 && currentCount !== lastRecentCount) {
      console.log('[CarPlayHandler] Recently played changed from', lastRecentCount, 'to', currentCount);
      
      // Trigger CarPlay template refresh
      debouncedRefresh(`Recently played changed: ${lastRecentCount} → ${currentCount}`);
    }
    
    lastRecentCount = currentCount;
  }, [recentStations]);

  // Native Auto owns its player; synchronizing the catalog must not start a second JS player.
  useEffect(() => {
    if (Platform.OS !== 'android' || !AndroidAutoModule?.syncCatalog) return;
    const serialize = (stations: Station[]) => stations.slice(0, 100).map(station => ({
      id: station._id,
      name: station.name,
      country: station.country || '',
      streamUrl: getStationStreamUrl(station),
      favicon: station.favicon || '',
    }));
    // Run on every array change, including clearing the stores on account switch.
    AndroidAutoModule.syncCatalog({
      country: countryEnglish || country || '',
      favorites: serialize(favorites || []),
      recent: serialize(recentStations || []),
      labels: {
        favorites: i18n.t('carplay_favorites'),
        recent: i18n.t('carplay_recently_played'),
        popular: i18n.t('carplay_popular_stations'),
        genres: i18n.t('genres'),
      },
    });
  }, [favorites, recentStations, country, countryEnglish, languageVersion]);

  // This component doesn't render anything
  return null;
};

export default CarPlayHandler;
