// Disk Cache Service - Web fallback (in-memory)
// Uses Map instead of MMKV since native modules aren't available on web

const memStore = new Map<string, string>();

// Cache TTL Constants (same as native)
export const CACHE_TTL = {
  STATIONS_BY_COUNTRY: 7 * 24 * 60 * 60 * 1000,
  GENRES: 7 * 24 * 60 * 60 * 1000,
  GENRE_STATIONS: 7 * 24 * 60 * 60 * 1000,
  POPULAR_STATIONS: 1 * 60 * 60 * 1000,
  COMMUNITY_FAVORITES: 30 * 60 * 1000,
  USER_PROFILE: 30 * 60 * 1000,
  PRECOMPUTED_GENRES: 7 * 24 * 60 * 60 * 1000,
  SEARCH: 0,
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

const CACHE_VERSION = 2;

export const diskCache = {
  set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      memStore.set(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('[DiskCache:Web] Set error:', key, e);
    }
  },

  get<T>(key: string, ttl: number): T | undefined {
    try {
      const raw = memStore.get(key);
      if (!raw) return undefined;

      const entry: CacheEntry<T> = JSON.parse(raw);

      if (entry.version !== CACHE_VERSION) {
        memStore.delete(key);
        return undefined;
      }

      if (ttl > 0 && Date.now() - entry.timestamp > ttl) {
        return undefined;
      }

      return entry.data;
    } catch (e) {
      console.warn('[DiskCache:Web] Get error:', key, e);
      return undefined;
    }
  },

  updatedAt(key: string): number {
    try {
      const raw = memStore.get(key);
      if (!raw) return 0;
      const entry = JSON.parse(raw);
      return entry.version === CACHE_VERSION && Number.isFinite(entry.timestamp) ? entry.timestamp : 0;
    } catch { return 0; }
  },

  getStale<T>(key: string): T | null {
    try {
      const raw = memStore.get(key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return null;
      return entry.data;
    } catch {
      return null;
    }
  },

  isFresh(key: string, ttl: number): boolean {
    try {
      const raw = memStore.get(key);
      if (!raw) return false;
      const entry = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return false;
      return Date.now() - entry.timestamp <= ttl;
    } catch {
      return false;
    }
  },

  delete(key: string): void {
    memStore.delete(key);
  },

  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(memStore.keys())) {
      if (key.startsWith(prefix)) {
        memStore.delete(key);
      }
    }
  },

  clearAll(): void {
    memStore.clear();
  },

  getStats(): { totalKeys: number; sizeEstimate: string } {
    let totalSize = 0;
    for (const val of memStore.values()) {
      totalSize += val.length;
    }
    return {
      totalKeys: memStore.size,
      sizeEstimate: `${(totalSize / 1024).toFixed(1)}KB`,
    };
  },
};

// Cache key generators (same as native)
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
