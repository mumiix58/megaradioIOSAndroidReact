// Disk Cache Service using MMKV (Native only)
// Ultra-fast key-value storage (30x faster than AsyncStorage)
// Used for persisting API data between app launches
// Falls back to AsyncStorage when MMKV is not available (still persistent!)
// Only uses in-memory Map on web (Expo Go)

import { Platform } from 'react-native';

let cacheStorage: any;
let cacheBackend: 'mmkv' | 'asyncstorage' | 'memory' = 'memory';

// Resolves when the backing store is readable (AsyncStorage fallback loads async)
let markCacheReady: () => void;
const cacheReadyPromise = new Promise<void>((resolve) => {
  markCacheReady = resolve;
});

// Initialize cache storage with proper fallback chain:
// MMKV (fastest) -> AsyncStorage (persistent) -> In-memory Map (last resort)
function initCacheStorage() {
  // Try MMKV first (native only)
  try {
    const { MMKV } = require('react-native-mmkv');
    cacheStorage = new MMKV({ id: 'megaradio-cache' });
    cacheBackend = 'mmkv';
    markCacheReady();
    console.log('[DiskCache] Using MMKV (native, fastest)');
    return;
  } catch (e) {
    console.warn('[DiskCache] MMKV not available:', (e as Error).message);
  }

  // Try AsyncStorage (persistent, slower but reliable)
  if (Platform.OS !== 'web') {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      // Wrap AsyncStorage to match MMKV sync API with async internals
      const memoryLayer = new Map<string, string>();
      let loaded = false;

      // Load all cached data into memory on init
      const loadFromDisk = async () => {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const cacheKeys = keys.filter((k: string) => k.startsWith('dc:'));
          if (cacheKeys.length > 0) {
            const pairs = await AsyncStorage.multiGet(cacheKeys);
            for (const [key, value] of pairs) {
              if (value) memoryLayer.set(key.replace('dc:', ''), value);
            }
          }
          loaded = true;
          console.log('[DiskCache] AsyncStorage loaded', memoryLayer.size, 'entries');
        } catch (err) {
          console.warn('[DiskCache] AsyncStorage load error:', err);
        } finally {
          markCacheReady();
        }
      };

      loadFromDisk();

      cacheStorage = {
        set: (key: string, value: string) => {
          memoryLayer.set(key, value);
          AsyncStorage.setItem('dc:' + key, value).catch(() => {});
        },
        getString: (key: string) => memoryLayer.get(key) ?? null,
        delete: (key: string) => {
          memoryLayer.delete(key);
          AsyncStorage.removeItem('dc:' + key).catch(() => {});
        },
        getAllKeys: () => Array.from(memoryLayer.keys()),
        clearAll: () => {
          const keys = Array.from(memoryLayer.keys()).map(k => 'dc:' + k);
          memoryLayer.clear();
          AsyncStorage.multiRemove(keys).catch(() => {});
        },
      };
      cacheBackend = 'asyncstorage';
      console.log('[DiskCache] Using AsyncStorage fallback (persistent)');
      return;
    } catch (e) {
      console.warn('[DiskCache] AsyncStorage not available:', (e as Error).message);
    }
  }

  // Last resort: In-memory Map (not persistent, web only)
  console.warn('[DiskCache] Using in-memory fallback (NOT persistent - data lost on restart!)');
  markCacheReady();
  const memStore = new Map<string, string>();
  cacheStorage = {
    set: (key: string, value: string) => memStore.set(key, value),
    getString: (key: string) => memStore.get(key) ?? null,
    delete: (key: string) => memStore.delete(key),
    getAllKeys: () => Array.from(memStore.keys()),
    clearAll: () => memStore.clear(),
  };
  cacheBackend = 'memory';
}

initCacheStorage();

// Cache TTL Constants
export const CACHE_TTL = {
  STATIONS_BY_COUNTRY: 7 * 24 * 60 * 60 * 1000,   // 7 days - station lists rarely change
  GENRES: 7 * 24 * 60 * 60 * 1000,                  // 7 days - genres rarely change
  GENRE_STATIONS: 7 * 24 * 60 * 60 * 1000,          // 7 days - genre station mappings
  POPULAR_STATIONS: 1 * 60 * 60 * 1000,              // 1 hour - popularity changes
  COMMUNITY_FAVORITES: 30 * 60 * 1000,               // 30 min - community activity
  USER_PROFILE: 30 * 60 * 1000,                      // 30 min
  PRECOMPUTED_GENRES: 7 * 24 * 60 * 60 * 1000,       // 7 days
  SEARCH: 0,                                          // Never cache search - always fresh
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

const CACHE_VERSION = 2;

export const diskCache = {
  getBackend(): string {
    return cacheBackend;
  },

  // Await this (with a timeout cap) before first reads on cold start —
  // the AsyncStorage fallback hydrates its memory layer asynchronously
  whenReady(): Promise<void> {
    return cacheReadyPromise;
  },

  set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      cacheStorage.set(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('[DiskCache] Set error:', key, e);
    }
  },

  get<T>(key: string, ttl: number): T | undefined {
    try {
      const raw = cacheStorage.getString(key);
      if (!raw) return undefined;

      const entry: CacheEntry<T> = JSON.parse(raw);

      if (entry.version !== CACHE_VERSION) {
        cacheStorage.delete(key);
        return undefined;
      }

      if (ttl > 0 && Date.now() - entry.timestamp > ttl) {
        return undefined;
      }

      return entry.data;
    } catch (e) {
      console.warn('[DiskCache] Get error:', key, e);
      return undefined;
    }
  },

  updatedAt(key: string): number {
    try {
      const raw = cacheStorage.getString(key);
      if (!raw) return 0;
      const entry = JSON.parse(raw);
      return entry.version === CACHE_VERSION && Number.isFinite(entry.timestamp) ? entry.timestamp : 0;
    } catch { return 0; }
  },

  getStale<T>(key: string): T | null {
    try {
      const raw = cacheStorage.getString(key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return null;
      return entry.data;
    } catch (e) {
      return null;
    }
  },

  isFresh(key: string, ttl: number): boolean {
    try {
      const raw = cacheStorage.getString(key);
      if (!raw) return false;
      const entry = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return false;
      return Date.now() - entry.timestamp <= ttl;
    } catch {
      return false;
    }
  },

  delete(key: string): void {
    try {
      cacheStorage.delete(key);
    } catch (e) {
      console.warn('[DiskCache] Delete error:', key, e);
    }
  },

  invalidatePrefix(prefix: string): void {
    try {
      const allKeys = cacheStorage.getAllKeys();
      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          cacheStorage.delete(key);
        }
      }
    } catch (e) {
      console.warn('[DiskCache] InvalidatePrefix error:', prefix, e);
    }
  },

  clearAll(): void {
    try {
      cacheStorage.clearAll();
      console.log('[DiskCache] All cache cleared');
    } catch (e) {
      console.warn('[DiskCache] ClearAll error:', e);
    }
  },

  getStats(): { totalKeys: number; sizeEstimate: string; backend: string } {
    try {
      const allKeys = cacheStorage.getAllKeys();
      let totalSize = 0;
      for (const key of allKeys) {
        const val = cacheStorage.getString(key);
        if (val) totalSize += val.length;
      }
      return {
        totalKeys: allKeys.length,
        sizeEstimate: `${(totalSize / 1024).toFixed(1)}KB`,
        backend: cacheBackend,
      };
    } catch {
      return { totalKeys: 0, sizeEstimate: '0KB', backend: cacheBackend };
    }
  },
};

// Cache key generators
export const cacheKeys = {
  popularStations: (country: string) => `popular:${country}`,
  stationsByCountry: (country: string, page: number) => `stations:${country}:p${page}`,
  genres: (country: string) => `genres:${country}`,
  precomputedGenres: (country: string) => `precomputed_genres:${country}`,
  genreStations: (genre: string, country: string, page: number) => `genre_stations:${genre}:${country}:p${page}`,
  communityFavorites: (country: string) => `community_favs:${country}`,
  userProfile: (userId: string) => `user_profile:${userId}`,
  allStations: (country: string, page: number) => `all_stations:${country}:p${page}`,
};
