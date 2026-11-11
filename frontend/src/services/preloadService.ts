import { QueryClient } from '@tanstack/react-query';
import api from './api';
import { CACHE_TTL } from './diskCacheService';
import { queryKeys } from '../hooks/useQueries';

// Preload user favorites for faster profile loading
// This runs in background without blocking UI

interface UserProfile {
  _id: string;
  slug?: string;
  name?: string;
  favorites_count?: number;
}

interface PreloadedFavorites {
  userId: string;
  favorites: any[];
  loadedAt: number;
}

// In-memory cache for preloaded favorites
const preloadedFavoritesCache = new Map<string, PreloadedFavorites>();

// Track which users are currently being preloaded
const loadingUsers = new Set<string>();

/**
 * Preload favorites for a single user
 */
export const preloadUserFavorites = async (
  userId: string,
  queryClient: QueryClient
): Promise<void> => {
  // Skip if already loading or cached
  if (loadingUsers.has(userId)) return;
  
  const cached = preloadedFavoritesCache.get(userId);
  const now = Date.now();
  
  // Use cached data if still fresh (5 minutes)
  if (cached && (now - cached.loadedAt) < CACHE_TTL.COMMUNITY_FAVORITES) {
    return;
  }

  loadingUsers.add(userId);

  try {
    // Use the same in-flight request/cache as the destination profile screen.
    const favorites = await queryClient.fetchQuery({
      queryKey: ['userFavorites', userId],
      queryFn: async () => {
        const response = await api.get(`/api/users/${userId}/favorites`);
        return response.data?.favorites || response.data || [];
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });

    // Store in local cache
    preloadedFavoritesCache.set(userId, {
      userId,
      favorites,
      loadedAt: now,
    });


  } catch (error) {
    console.log(`[Preload] Failed to preload favorites for ${userId}`);
  } finally {
    loadingUsers.delete(userId);
  }
};

/**
 * Preload favorites for multiple users (first 6 immediately, rest in background)
 */
export const preloadPublicProfileFavorites = async (
  profiles: UserProfile[],
  queryClient: QueryClient
): Promise<void> => {
  if (!profiles || profiles.length === 0) return;

  // First 6 users - preload immediately (parallel)
  const priorityUsers = profiles.slice(0, 6);
  const remainingUsers = profiles.slice(6);

  console.log(`[Preload] Starting preload for ${priorityUsers.length} priority users`);

  // Preload priority users in parallel
  await Promise.all(
    priorityUsers.map(user => preloadUserFavorites(user._id, queryClient))
  );

  console.log(`[Preload] Priority users preloaded`);

  // Preload remaining users in background (one at a time to avoid overwhelming)
  if (remainingUsers.length > 0) {
    console.log(`[Preload] Starting background preload for ${remainingUsers.length} remaining users`);
    
    // Use setTimeout to not block UI
    setTimeout(async () => {
      for (const user of remainingUsers) {
        await preloadUserFavorites(user._id, queryClient);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log(`[Preload] Background preload complete`);
    }, 1000);
  }
};

/**
 * Get preloaded favorites from cache
 */
export const getPreloadedFavorites = (userId: string): any[] | null => {
  const cached = preloadedFavoritesCache.get(userId);
  if (!cached) return null;

  const now = Date.now();
  // Return null if cache is stale
  if ((now - cached.loadedAt) > CACHE_TTL.COMMUNITY_FAVORITES) {
    preloadedFavoritesCache.delete(userId);
    return null;
  }

  return cached.favorites;
};

/**
 * Clear all preloaded cache
 */
export const clearPreloadedCache = (): void => {
  preloadedFavoritesCache.clear();
  loadingUsers.clear();
};

/**
 * Preload essential data on app startup
 * Call this from _layout.tsx after QueryClient is ready
 */
export const preloadEssentialData = async (queryClient: QueryClient): Promise<void> => {
  console.log('[Preload] Starting essential data preload');

  try {
    // 1. Fetch public profiles first
    const profilesResponse = await api.get('/api/public-profiles', {
      params: { limit: 20 }
    });
    
    const profiles = profilesResponse.data?.data || profilesResponse.data || [];
    
    // Cache the profiles in React Query
    queryClient.setQueryData(['publicProfiles', 10], profiles.slice(0, 10));
    queryClient.setQueryData(['publicProfiles', 20], profiles);

    // 2. Preload favorites for these users
    await preloadPublicProfileFavorites(profiles, queryClient);

    console.log('[Preload] Essential data preload complete');
  } catch (error) {
    console.log('[Preload] Error during essential data preload:', error);
  }
};

/**
 * Preload station & genre data for a given country
 * Populates disk cache for instant screen loads
 */
export const preloadStationData = async (country: string): Promise<void> => {
  if (!country) return;
  
  console.log('[Preload] Starting station data preload for:', country);
  
  try {
    const { diskCache, cacheKeys, CACHE_TTL } = await import('./diskCacheService');
    
    // Skip if already cached and fresh
    const popularKey = cacheKeys.popularStations(country);
    const genresKey = cacheKeys.genres(country);
    
    const popularFresh = diskCache.isFresh(popularKey, CACHE_TTL.POPULAR_STATIONS);
    const genresFresh = diskCache.isFresh(genresKey, CACHE_TTL.GENRES);
    
    const fetches: Promise<void>[] = [];
    
    // 1. Popular stations
    if (!popularFresh) {
      fetches.push(
        api.get('/api/stations/popular', { params: { country, limit: 50 } })
          .then(res => {
            const stations = res.data?.stations || res.data || [];
            if (stations.length > 0) {
              diskCache.set(popularKey, stations);
              console.log('[Preload] Cached', stations.length, 'popular stations for', country);
            }
          })
          .catch(() => {})
      );
    }
    
    // 2. Genres
    if (!genresFresh) {
      fetches.push(
        api.get('/api/genres', { params: { country } })
          .then(res => {
            const genres = res.data?.genres || res.data || [];
            if (genres.length > 0) {
              diskCache.set(genresKey, genres);
              console.log('[Preload] Cached', genres.length, 'genres for', country);
            }
          })
          .catch(() => {})
      );
    }
    
    // 3. Precomputed genres
    const precomputedKey = cacheKeys.precomputedGenres(country);
    if (!diskCache.isFresh(precomputedKey, CACHE_TTL.PRECOMPUTED_GENRES)) {
      fetches.push(
        api.get('/api/genres/precomputed', { params: { country } })
          .then(res => {
            const data = res.data;
            if (data) {
              diskCache.set(precomputedKey, data);
              console.log('[Preload] Cached precomputed genres for', country);
            }
          })
          .catch(() => {})
      );
    }
    
    await Promise.all(fetches);
    console.log('[Preload] Station data preload complete for:', country);
  } catch (error) {
    console.log('[Preload] Station data preload error:', error);
  }
};

export default {
  preloadUserFavorites,
  preloadPublicProfileFavorites,
  getPreloadedFavorites,
  clearPreloadedCache,
  preloadEssentialData,
  preloadStationData,
};
