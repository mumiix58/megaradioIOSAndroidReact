import { sortFavoriteStations } from '../utils/favoriteOrdering';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { userService } from '../services/userService';
import { useAuthStore } from './authStore';
import { flowaliveService } from '../services/flowaliveService';
import type { Station } from '../types';

const FAVORITES_KEY = '@megaradio_favorites';
const FAVORITES_ORDER_KEY = '@megaradio_favorites_order';
const ANDROID_AUTO_FAVORITES_KEY = 'megaradio_android_auto_favorites';
const SYNC_QUEUE_KEY = '@megaradio_favorites_sync_queue';

// Pending sync queue types
interface SyncQueueItem {
  action: 'add' | 'remove';
  stationId: string;
  timestamp: number;
}

// Process pending sync queue - retry failed API operations
const processSyncQueue = async (): Promise<void> => {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueJson) return;
    
    const queue: SyncQueueItem[] = JSON.parse(queueJson);
    if (queue.length === 0) return;
    
    console.log('[FavoritesStore] Processing sync queue:', queue.length, 'items');
    const remaining: SyncQueueItem[] = [];
    
    for (const item of queue) {
      try {
        if (item.action === 'add') {
          await userService.addFavorite(item.stationId);
          console.log('[FavoritesStore] Sync queue: added', item.stationId);
        } else {
          await userService.removeFavorite(item.stationId);
          console.log('[FavoritesStore] Sync queue: removed', item.stationId);
        }
      } catch (e) {
        // Keep in queue if still failing
        remaining.push(item);
      }
    }
    
    if (remaining.length > 0) {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
      console.log('[FavoritesStore] Sync queue: still pending', remaining.length, 'items');
    } else {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      console.log('[FavoritesStore] Sync queue: all synced!');
    }
  } catch (e) {
    console.log('[FavoritesStore] Sync queue processing error:', e);
  }
};

// Add item to sync queue
const addToSyncQueue = async (action: 'add' | 'remove', stationId: string): Promise<void> => {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = queueJson ? JSON.parse(queueJson) : [];
    
    // Remove conflicting entries for same station
    const filtered = queue.filter(q => q.stationId !== stationId);
    filtered.push({ action, stationId, timestamp: Date.now() });
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    console.log('[FavoritesStore] Added to sync queue:', action, stationId);
  } catch (e) {
    console.log('[FavoritesStore] Error adding to sync queue:', e);
  }
};

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'custom';
export type ViewMode = 'list' | 'grid';

interface FavoritesState {
  favorites: Station[];
  customOrder: string[];
  sortOption: SortOption;
  viewMode: ViewMode;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadFavorites: () => Promise<void>;
  loadFromLocal: () => Promise<void>;
  loadLocalFavorites: () => Promise<void>;
  addFavorite: (station: Station) => Promise<void>;
  removeFavorite: (stationId: string) => Promise<void>;
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (station: Station) => Promise<void>;
  setSortOption: (option: SortOption) => void;
  setViewMode: (mode: ViewMode) => void;
  updateCustomOrder: (orderedIds: string[]) => Promise<void>;
  getSortedFavorites: () => Station[];
  syncWithServer: () => Promise<void>;
}

// Helper to check if user is authenticated
const isAuthenticated = (): boolean => {
  return useAuthStore.getState().isAuthenticated;
};

// Helper to load user-specific backup favorites from AsyncStorage
const loadUserBackup = async (userId: string): Promise<Station[]> => {
  try {
    const backupJson = await AsyncStorage.getItem(`@megaradio_favorites_backup_${userId}`);
    if (backupJson) {
      const parsed = JSON.parse(backupJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.log('[FavoritesStore] Error loading user backup:', e);
  }
  return [];
};

// Helper to sync favorites to Android Auto via SharedPreferences
// This is needed because Android Auto's MediaBrowserService runs in native code
const syncToAndroidAuto = async (favorites: Station[]): Promise<void> => {
  if (Platform.OS !== 'android') return;
  
  try {
    // Format favorites for Android Auto consumption
    const autoFavorites = favorites.slice(0, 20).map(station => ({
      id: station._id,
      name: station.name,
      country: station.country || '',
      streamUrl: (station as any).urlResolved || station.url || '',
      favicon: station.favicon || station.logo || '',
    }));
    
    // Store in AsyncStorage with a specific key that Android native code can read
    // SharedPreferences on Android can access the same storage
    await AsyncStorage.setItem(
      ANDROID_AUTO_FAVORITES_KEY, 
      JSON.stringify(autoFavorites)
    );
    
    console.log('[FavoritesStore] Synced', autoFavorites.length, 'favorites to Android Auto');
  } catch (error) {
    console.error('[FavoritesStore] Error syncing to Android Auto:', error);
  }
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  customOrder: [],
  sortOption: 'newest',
  viewMode: 'list',
  isLoaded: false,
  isLoading: false,
  error: null,

  loadFavorites: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { user, token, isAuthenticated: authStatus } = useAuthStore.getState();
      
      console.log('[FavoritesStore] ========== loadFavorites START ==========');
      console.log('[FavoritesStore] isAuthenticated:', authStatus);
      console.log('[FavoritesStore] user._id:', user?._id);
      console.log('[FavoritesStore] token:', token ? token.substring(0, 20) + '...' : 'NULL');
      
      // Process any pending sync operations first
      if (authStatus && token) {
        await processSyncQueue();
      }
      
      if (authStatus && user?._id && token) {
        try {
          console.log('[FavoritesStore] Calling userService.getFavorites()...');
          
          const favorites = await userService.getFavorites();
          
          console.log('[FavoritesStore] Response received!');
          console.log('[FavoritesStore] Type:', typeof favorites);
          console.log('[FavoritesStore] Is Array:', Array.isArray(favorites));
          console.log('[FavoritesStore] Length:', Array.isArray(favorites) ? favorites.length : 'N/A');
          
          if (!Array.isArray(favorites)) {
            console.log('[FavoritesStore] WARNING: favorites is not an array!');
            console.log('[FavoritesStore] Keys:', Object.keys(favorites || {}));
            const extractedFavorites = (favorites as any)?.favorites || (favorites as any)?.stations || [];
            console.log('[FavoritesStore] Extracted length:', extractedFavorites.length);
            
            if (extractedFavorites.length === 0) {
              // Try user-specific backup
              const backupFavs = await loadUserBackup(user._id);
              if (backupFavs.length > 0) {
                console.log('[FavoritesStore] Restored', backupFavs.length, 'favorites from user backup');
                const orderJson = await AsyncStorage.getItem(FAVORITES_ORDER_KEY);
                const customOrder = orderJson ? JSON.parse(orderJson) : [];
                set({ favorites: backupFavs, customOrder, isLoaded: true, isLoading: false });
                await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(backupFavs));
                syncToAndroidAuto(backupFavs);
                return;
              }
            }
            
            const orderJson = await AsyncStorage.getItem(FAVORITES_ORDER_KEY);
            const customOrder = orderJson ? JSON.parse(orderJson) : [];
            set({ favorites: extractedFavorites, customOrder, isLoaded: true, isLoading: false });
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(extractedFavorites));
            syncToAndroidAuto(extractedFavorites);
            return;
          }
          
          // If API returns empty, try user-specific backup before giving up
          if (favorites.length === 0) {
            const backupFavs = await loadUserBackup(user._id);
            if (backupFavs.length > 0) {
              console.log('[FavoritesStore] API returned empty, restored', backupFavs.length, 'from user backup');
              const orderJson = await AsyncStorage.getItem(FAVORITES_ORDER_KEY);
              const customOrder = orderJson ? JSON.parse(orderJson) : [];
              set({ favorites: backupFavs, customOrder, isLoaded: true, isLoading: false });
              await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(backupFavs));
              syncToAndroidAuto(backupFavs);
              // Try to re-sync backup favorites to server
              for (const station of backupFavs) {
                try {
                  await userService.addFavorite(station._id);
                } catch (e) {
                  // Ignore individual sync errors
                }
              }
              return;
            }
          }
          
          // Also load custom order from local storage
          const orderJson = await AsyncStorage.getItem(FAVORITES_ORDER_KEY);
          const customOrder = orderJson ? JSON.parse(orderJson) : [];
          
          set({ favorites, customOrder, isLoaded: true, isLoading: false });
          console.log('[FavoritesStore] ========== SUCCESS: ' + favorites.length + ' favorites ==========');
          
          // Save to local storage as backup
          await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
          
          // Also update user-specific backup
          if (favorites.length > 0) {
            await AsyncStorage.setItem(
              `@megaradio_favorites_backup_${user._id}`,
              JSON.stringify(favorites)
            );
          }
          
          // Sync to Android Auto
          syncToAndroidAuto(favorites);
          return;
        } catch (apiError: any) {
          console.log('[FavoritesStore] API ERROR:', apiError.message);
          console.log('[FavoritesStore] Status:', apiError.response?.status);
          console.log('[FavoritesStore] Data:', JSON.stringify(apiError.response?.data || {}).substring(0, 200));
          
          // API failed - try user-specific backup
          if (user?._id) {
            const backupFavs = await loadUserBackup(user._id);
            if (backupFavs.length > 0) {
              console.log('[FavoritesStore] API failed, restored', backupFavs.length, 'from user backup');
              set({ favorites: backupFavs, isLoaded: true, isLoading: false });
              await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(backupFavs));
              syncToAndroidAuto(backupFavs);
              return;
            }
          }
        }
      } else {
        console.log('[FavoritesStore] NOT AUTHENTICATED - falling back to local');
        console.log('[FavoritesStore] - authStatus:', authStatus);
        console.log('[FavoritesStore] - user._id:', user?._id);
        console.log('[FavoritesStore] - token:', token ? 'EXISTS' : 'NULL');
      }
      
      // Fallback to local storage
      console.log('[FavoritesStore] Loading from local storage...');
      await get().loadFromLocal();
    } catch (error) {
      console.error('[FavoritesStore] FATAL ERROR:', error);
      set({ isLoading: false, isLoaded: true, error: 'Failed to load favorites' });
    }
  },

  // Helper to load from local storage
  loadFromLocal: async () => {
    try {
      const [favoritesJson, orderJson] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(FAVORITES_ORDER_KEY),
      ]);
      
      const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
      const customOrder = orderJson ? JSON.parse(orderJson) : [];
      
      set({ favorites, customOrder, isLoaded: true, isLoading: false });
      
      // Sync to Android Auto
      syncToAndroidAuto(favorites);
    } catch (error) {
      console.error('Error loading from local storage:', error);
      set({ isLoaded: true, isLoading: false });
    }
  },

  addFavorite: async (station: Station) => {
    const { favorites, customOrder } = get();
    
    // Check if already exists
    if (favorites.some(f => f._id === station._id)) {
      console.log('[FavoritesStore] Station already in favorites:', station._id);
      return;
    }

    // Optimistic update
    const updatedFavorites = [
      { ...station, addedAt: new Date().toISOString() } as Station,
      ...favorites,
    ];
    const updatedOrder = [station._id, ...customOrder];
    set({ favorites: updatedFavorites, customOrder: updatedOrder });

    // Track favorite event in analytics
    flowaliveService.trackStationFavorited(station._id, station.name);

    try {
      // First save to local storage
      console.log('[FavoritesStore] Saving to AsyncStorage:', FAVORITES_KEY, 'favorites count:', updatedFavorites.length);
      await Promise.all([
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites)),
        AsyncStorage.setItem(FAVORITES_ORDER_KEY, JSON.stringify(updatedOrder)),
      ]);
      console.log('[FavoritesStore] Local save complete');
      
      // Then try to sync with server if authenticated
      if (isAuthenticated()) {
        console.log('[FavoritesStore] User is authenticated, syncing to API...');
        try {
          const result = await userService.addFavorite(station._id);
          console.log('[FavoritesStore] API sync SUCCESS:', result);
        } catch (apiError: any) {
          console.error('[FavoritesStore] API sync FAILED:', apiError?.response?.status, apiError?.response?.data || apiError.message);
          // Queue for retry on next loadFavorites
          await addToSyncQueue('add', station._id);
        }
      } else {
        console.log('[FavoritesStore] User not authenticated, skipping API sync');
      }
      
      // Sync to Android Auto
      syncToAndroidAuto(updatedFavorites);
      
      // Update user-specific backup
      const authState = useAuthStore.getState();
      if (authState.isAuthenticated && authState.user?._id) {
        await AsyncStorage.setItem(
          `@megaradio_favorites_backup_${authState.user._id}`,
          JSON.stringify(updatedFavorites)
        );
      }
      
      console.log('[FavoritesStore] addFavorite complete');
    } catch (error: any) {
      console.error('[FavoritesStore] Error adding favorite:', error?.message || error);
      // Revert on local storage error
      set({ favorites, customOrder });
    }
  },

  removeFavorite: async (stationId: string) => {
    const { favorites, customOrder } = get();
    
    // Find station name for analytics
    const removedStation = favorites.find(f => f._id === stationId);
    
    // Optimistic update
    const updatedFavorites = favorites.filter(f => f._id !== stationId);
    const updatedOrder = customOrder.filter(id => id !== stationId);
    set({ favorites: updatedFavorites, customOrder: updatedOrder });

    // Track unfavorite event in analytics
    if (removedStation) {
      flowaliveService.trackStationUnfavorited(stationId, removedStation.name);
    }

    try {
      // First save to local storage
      console.log('[FavoritesStore] Removing from AsyncStorage, new count:', updatedFavorites.length);
      await Promise.all([
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites)),
        AsyncStorage.setItem(FAVORITES_ORDER_KEY, JSON.stringify(updatedOrder)),
      ]);
      console.log('[FavoritesStore] Local remove complete');
      
      // Then try to sync with server if authenticated
      if (isAuthenticated()) {
        console.log('[FavoritesStore] User is authenticated, syncing remove to API...');
        try {
          const result = await userService.removeFavorite(stationId);
          console.log('[FavoritesStore] API remove SUCCESS:', result);
        } catch (apiError: any) {
          console.error('[FavoritesStore] API remove FAILED:', apiError?.response?.status, apiError?.response?.data || apiError.message);
          // Queue for retry on next loadFavorites
          await addToSyncQueue('remove', stationId);
        }
      } else {
        console.log('[FavoritesStore] User not authenticated, skipping API sync');
      }
      
      // Sync to Android Auto
      syncToAndroidAuto(updatedFavorites);
      
      // Update user-specific backup
      const authState = useAuthStore.getState();
      if (authState.isAuthenticated && authState.user?._id) {
        await AsyncStorage.setItem(
          `@megaradio_favorites_backup_${authState.user._id}`,
          JSON.stringify(updatedFavorites)
        );
      }
      
      console.log('[FavoritesStore] removeFavorite complete');
    } catch (error: any) {
      console.error('[FavoritesStore] Error removing favorite:', error?.message || error);
      // Revert on local storage error
      set({ favorites, customOrder });
    }
  },

  isFavorite: (stationId: string) => {
    return get().favorites.some(f => f._id === stationId);
  },

  toggleFavorite: async (station: Station) => {
    const { isFavorite, addFavorite, removeFavorite } = get();
    
    console.log('[FavoritesStore] toggleFavorite called for:', station._id, station.name);
    console.log('[FavoritesStore] isFavorite:', isFavorite(station._id));
    
    if (isFavorite(station._id)) {
      console.log('[FavoritesStore] Removing favorite...');
      await removeFavorite(station._id);
    } else {
      console.log('[FavoritesStore] Adding favorite...');
      await addFavorite(station);
    }
    console.log('[FavoritesStore] toggleFavorite complete');
  },

  setSortOption: (option: SortOption) => {
    set({ sortOption: option });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  updateCustomOrder: async (orderedIds: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_ORDER_KEY, JSON.stringify(orderedIds));
      set({ customOrder: orderedIds });
    } catch (error) {
      console.error('Error updating custom order:', error);
      throw error;
    }
  },

  getSortedFavorites: () => {
    const { favorites, customOrder, sortOption } = get();
    
    return sortFavoriteStations(favorites, customOrder, sortOption);
  },

  // Load favorites from local storage only (for CarPlay/Android Auto)
  loadLocalFavorites: async () => {
    try {
      const favoritesJson = await AsyncStorage.getItem(FAVORITES_KEY);
      const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
      set({ favorites, isLoaded: true, isLoading: false });
      console.log('[FavoritesStore] Loaded', favorites.length, 'favorites from local storage');
      syncToAndroidAuto(favorites);
    } catch (error) {
      console.error('[FavoritesStore] Error loading from local:', error);
      set({ isLoaded: true, isLoading: false });
    }
  },

  // Sync local favorites with server (for when user logs in)
  syncWithServer: async () => {
    if (!isAuthenticated()) return;
    
    const { favorites } = get();
    
    try {
      // Get server favorites - getFavorites() returns Station[] directly
      const serverFavorites = await userService.getFavorites();
      
      if (!Array.isArray(serverFavorites)) {
        console.error('[FavoritesStore] syncWithServer: unexpected response type');
        return;
      }
      
      // Merge: server + local (server takes priority for duplicates)
      const serverIds = new Set(serverFavorites.map((f: Station) => f._id));
      const localOnly = favorites.filter(f => !serverIds.has(f._id));
      
      // Add local-only favorites to server
      for (const station of localOnly) {
        try {
          await userService.addFavorite(station._id);
        } catch (e) {
          console.log('[FavoritesStore] Failed to sync station to server:', station._id);
        }
      }
      
      // Reload to get merged list
      await get().loadFavorites();
    } catch (error) {
      console.error('[FavoritesStore] Error syncing favorites:', error);
    }
  },
}));

export default useFavoritesStore;
