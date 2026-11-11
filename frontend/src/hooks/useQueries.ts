import { buildGlobalPopularPool } from '../utils/popularStationRotation';
import { STATION_SEARCH_VERSION } from '../utils/stationSearch';
import { nearbyScope } from '../utils/nearbyScope';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import stationService, { StationQueryParams } from '../services/stationService';
import genreService from '../services/genreService';
import userService from '../services/userService';
import api from '../services/api';
import type { Station } from '../types';
import { useAuthStore } from '../store/authStore';
import { diskCache, cacheKeys, CACHE_TTL } from '../services/diskCacheService';

export function catalogCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const normalized = Object.keys(params).sort().filter(key => params[key] !== undefined)
    .map(key => [key, params[key]]);
  return `catalog:v2:${endpoint}:${JSON.stringify(normalized)}`;
}

// Stale-While-Revalidate pattern:
// 1. Show cached data immediately (if available)
// 2. Fetch fresh data in background
// 3. Update UI when fresh data arrives
// 4. Save fresh data to disk cache

// Catalog data retains disk fallback but revalidates after one minute.
const LONG_CACHE = {
  staleTime: 60 * 1000, // Revalidate catalog visibility within one minute
  gcTime: 30 * 60 * 1000,              // 30 min in memory
  refetchOnMount: true,
  refetchOnWindowFocus: true,
};

// MEDIUM CACHE - Data that changes occasionally (popular, community)
const MEDIUM_CACHE = {
  staleTime: 60 * 1000,
  gcTime: 60 * 60 * 1000,     // 1 hour in memory
  refetchOnMount: true,
  refetchOnWindowFocus: true,
};

// SHORT CACHE - User-specific data
const SHORT_CACHE = {
  staleTime: 60 * 1000,
  gcTime: 30 * 60 * 1000,     // 30 min in memory
  refetchOnMount: true,
  refetchOnWindowFocus: true,
};

// NO CACHE - Search, always fresh
const NO_CACHE = {
  staleTime: 0,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
};

// Query keys
export const queryKeys = {
  stations: ['stations'] as const,
  popularStations: (country?: string) => ['popularStations', country || 'global'] as const,
  nearbyStations: (lat: number, lng: number) => ['stations', 'nearby', lat, lng] as const,
  precomputedStations: (country?: string) => ['stations', 'precomputed', country] as const,
  station: (id: string) => ['station', id] as const,
  similarStations: (id: string) => ['stations', 'similar', id] as const,
  searchStations: (query: string) => ['stations', 'search', query] as const,
  top100: (country?: string) => ['stations', 'top100', country] as const,
  genres: ['genres'] as const,
  precomputedGenres: (country?: string) => ['precomputedGenres', country || 'global'] as const,
  discoverableGenres: ['discoverableGenres'] as const,
  genreStations: (slug: string) => ['genreStations', slug] as const,
  favorites: ['user', 'favorites'] as const,
  recentlyPlayed: ['recentlyPlayed'] as const,
  communityFavorites: ['communityFavorites'] as const,
};

// Station hooks - LONG CACHE (7 days disk, revalidate in background)
export const useStations = (params: StationQueryParams = {}, enabled = true) => {
  const country = params.country || 'global';
  const page = params.page || 1;
  const dKey = catalogCacheKey('stations', {...params,country,page});
  
  return useQuery({
    queryKey: [...queryKeys.stations, params, params.search ? STATION_SEARCH_VERSION : 'catalog'],
    enabled,
    queryFn: async ({ signal }) => {
      const result = await stationService.getStations(params, signal);
      if (!params.search) diskCache.set(dKey, result);
      return result;
    },
    initialData: params.search ? undefined : () => diskCache.get(dKey, CACHE_TTL.STATIONS_BY_COUNTRY),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    ...(params.search ? NO_CACHE : LONG_CACHE),
  });
};

export const usePopularStations = (country?: string, limit: number = 12, enabled = true, diverseCountries = false) => {
  const dKey = `${cacheKeys.popularStations(country || 'global')}:${limit}${diverseCountries ? ':countries-v1' : ''}`;
  
  return useQuery({
    queryKey: [...queryKeys.popularStations(country), limit, ...(diverseCountries ? ['countries-v1'] : [])],
    enabled,
    queryFn: async () => {
      const result = await stationService.getPopularStations(country, diverseCountries ? Math.max(80, limit) : limit);
      const data = { stations: diverseCountries ? buildGlobalPopularPool(result.stations || [], limit) : result.stations || [] };
      diskCache.set(dKey, data);
      return data;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.POPULAR_STATIONS),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    ...MEDIUM_CACHE,
  });
};

export const useNearbyStations = (lat: number | null, lng: number | null, radius: number = 150, limit: number = 12, country?: string, enabled = true) => {
  const scope = nearbyScope(lat, lng, country);
  return useQuery({
    queryKey: ['stations', 'nearby', scope.params, radius, limit],
    queryFn: () => stationService.getNearbyStations(lat, lng, radius, limit, country),
    enabled: enabled && scope.enabled,
    ...MEDIUM_CACHE,
  });
};

export const usePrecomputedStations = (
  country?: string,
  countryName?: string,
  page: number = 1,
  limit: number = 33
) => {
  const dKey = catalogCacheKey('precomputed', { country: country || 'global', countryName, page, limit });
  
  return useQuery({
    queryKey: [...queryKeys.precomputedStations(country), countryName, page, limit],
    queryFn: async () => {
      const result = await stationService.getPrecomputedStations(country, countryName, page, limit);
      diskCache.set(dKey, result);
      return result;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.STATIONS_BY_COUNTRY),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    ...LONG_CACHE,
  });
};

export const useStation = (identifier: string) => {
  return useQuery({
    queryKey: queryKeys.station(identifier),
    queryFn: () => stationService.getStation(identifier),
    enabled: !!identifier,
    ...MEDIUM_CACHE,
  });
};

export const useSimilarStations = (stationId: string, limit: number = 12) => {
  return useQuery({
    queryKey: [...queryKeys.similarStations(stationId), limit],
    queryFn: () => stationService.getSimilarStations(stationId, limit),
    enabled: stationId.length > 0,
    ...MEDIUM_CACHE,
    retry: false,
  });
};

export const useSearchStations = (query: string, limit: number = 20) => {
  return useQuery({
    queryKey: [...queryKeys.searchStations(query), STATION_SEARCH_VERSION, limit],
    queryFn: ({signal}) => stationService.searchStations(query, limit, signal),
    enabled: query.length >= 2,
    ...NO_CACHE, // Search always fresh
    retry: false,
  });
};

export const useTop100 = (country?: string) => {
  const dKey = cacheKeys.popularStations(`top100:${country || 'global'}`);
  
  return useQuery({
    queryKey: queryKeys.top100(country),
    queryFn: async () => {
      const result = await stationService.getTop100(country);
      diskCache.set(dKey, result);
      return result;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.POPULAR_STATIONS),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    ...MEDIUM_CACHE,
  });
};

// Genre hooks
export const useGenres = (page: number = 1, limit: number = 50) => {
  const dKey = catalogCacheKey('genres', { page, limit });
  
  return useQuery({
    queryKey: [...queryKeys.genres, page, limit],
    queryFn: async () => {
      const result = await genreService.getGenres(page, limit);
      diskCache.set(dKey, result);
      return result;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.GENRES),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    ...LONG_CACHE,
  });
};

export const usePrecomputedGenres = (country?: string, enabled = true) => {
  const dKey = cacheKeys.precomputedGenres(country || 'global');
  
  return useQuery({
    queryKey: queryKeys.precomputedGenres(country),
    enabled,
    queryFn: async () => {
      const result = await genreService.getPrecomputedGenres(country);
      diskCache.set(dKey, result);
      return result;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.PRECOMPUTED_GENRES),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    ...LONG_CACHE,
  });
};

export const useGenreStations = (
  slug: string,
  page: number = 1,
  limit: number = 25,
  countryEnglish?: string,
  sort?: 'votes' | 'name' | 'createdAt',
  order?: 'asc' | 'desc',
  countryNative?: string
) => {
  const country = countryEnglish || countryNative || 'global';
  const dKey = catalogCacheKey('genreStations', { slug, page, limit, countryEnglish, countryNative, sort, order });
  
  return useQuery({
    queryKey: [...queryKeys.genreStations(slug), page, limit, countryEnglish, countryNative, sort, order],
    queryFn: async () => {
      const result = await genreService.getGenreStations(slug, page, limit, countryEnglish, sort, order, countryNative);
      diskCache.set(dKey, result);
      return result;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.GENRE_STATIONS),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    enabled: !!slug,
    ...LONG_CACHE,
  });
};

export const useDiscoverableGenres = () => {
  const dKey = 'discoverable_genres';
  
  return useQuery({
    queryKey: queryKeys.discoverableGenres,
    queryFn: async () => {
      const result = await genreService.getDiscoverableGenres();
      const data = Array.isArray(result) ? result : [];
      diskCache.set(dKey, data);
      return data;
    },
    initialData: () => diskCache.get(dKey, CACHE_TTL.GENRES),
    initialDataUpdatedAt: () => diskCache.updatedAt(dKey),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    ...LONG_CACHE,
  });
};

// User hooks - keep some caching for user data
export const useFavorites = () => {
  const userId = useAuthStore(state => state.user?._id);
  return useQuery({
    enabled: !!userId,
    queryKey: [...queryKeys.favorites, userId],
    queryFn: () => userService.getFavorites(),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useRecentlyPlayed = () => {
  // Use hook to get reactive auth state
  const { useAuthStore } = require('../store/authStore');
  const isAuthenticated = useAuthStore((state: any) => state.isAuthenticated);
  const userId = useAuthStore((state: any) => state.user?._id);
  
  return useQuery({
    queryKey: [...queryKeys.recentlyPlayed, isAuthenticated, userId],
    queryFn: () => userService.getRecentlyPlayed(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30 * 1000,  // 30 seconds
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useCommunityFavorites = (limit: number = 20) => {
  const dKey = catalogCacheKey('community', { limit });
  
  return useQuery({
    queryKey: [...queryKeys.communityFavorites, limit],
    queryFn: async () => {
      const result = await stationService.getCommunityFavorites(limit);
      diskCache.set(dKey, result);
      return result;
    },
    // Use placeholderData instead of initialData to always fetch fresh data
    placeholderData: () => diskCache.get(dKey, CACHE_TTL.COMMUNITY_FAVORITES),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export const usePublicProfiles = (limit: number = 10) => {
  const dKey = `public_profiles:${limit}:v2`;
  
  return useQuery({
    queryKey: ['publicProfiles', limit],
    queryFn: async () => {
      const result = await stationService.getPublicProfiles(limit);
      diskCache.set(dKey, result);
      return result;
    },
    // Use placeholderData instead of initialData:
    // - Shows cached data instantly (no loading flash)
    // - ALWAYS fetches fresh data from API (doesn't treat cache as "real" data)
    // - Fixes issue where empty cached array prevented API refetch
    placeholderData: () => diskCache.get(dKey, CACHE_TTL.COMMUNITY_FAVORITES),
    staleTime: 60 * 1000,  // Public profile visibility revalidation
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true, // Reuse fresh data for five minutes; refresh stale profiles on revisit
    refetchOnWindowFocus: false,
  });
};

// User profile favorites hook
export const useUserFavorites = (userId: string) => {
  const viewerId = useAuthStore(state => state.user?._id);
  return useQuery({
    queryKey: ['userFavorites', userId, viewerId],
    queryFn: async () => {
      const response = await api.get(`/api/users/${userId}/favorites`);
      return response.data?.favorites || response.data || [];
    },
    enabled: !!userId,
    ...SHORT_CACHE,
  });
};

// User profile info hook
export const useUserProfile = (userId: string) => {
  const viewerId = useAuthStore(state => state.user?._id);
  return useQuery({
    queryKey: ['userProfile', userId, viewerId],
    queryFn: async () => (await api.get(`/api/user-profile/${userId}`)).data,
    enabled: !!userId,
    ...SHORT_CACHE,
  });
};

// Mutations
export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (stationId: string) => userService.addFavorite(stationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (stationId: string) => userService.removeFavorite(stationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
};
