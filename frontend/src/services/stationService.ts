// Station Service - Direct API calls without local caching
// All data is fetched fresh from API

import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import { streamService } from './streamService';
import type { Station } from '../types';

export interface StationQueryParams {
  page?: number;
  limit?: number;
  country?: string;
  genre?: string;
  search?: string;
  sort?: 'votes' | 'clickCount' | 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export const stationService = {
  // Get single station by identifier (slug or id)
  async getStation(identifier: string): Promise<Station | null> {
    try {
      const response = await api.get(API_ENDPOINTS.stations.single(identifier));
      return response.data;
    } catch (error) {
      console.error('[stationService] getStation error:', error);
      throw error;
    }
  },

  // Get list of stations - direct API call
  async getStations(params: StationQueryParams = {}): Promise<{ stations: Station[]; totalCount: number }> {
    try {
      console.log('[stationService] getStations - params:', params);
      const response = await api.get(API_ENDPOINTS.stations.list, { params });
      return response.data;
    } catch (error) {
      console.error('[stationService] getStations error:', error);
      throw error;
    }
  },

  // Get popular stations - direct API call
  async getPopularStations(country?: string, limit: number = 12): Promise<{ stations: Station[]; count: number }> {
    try {
      console.log('[stationService] getPopularStations - country:', country, 'limit:', limit);
      const response = await api.get(API_ENDPOINTS.stations.popular, {
        params: { country, limit, excludeBroken: true },
      });
      
      const data = response.data;
      let stations: Station[] = [];
      
      if (Array.isArray(data)) {
        stations = data;
      } else if (data?.stations) {
        stations = data.stations;
      } else if (data?.data) {
        stations = data.data;
      }
      
      console.log('[stationService] Got', stations.length, 'popular stations for', country || 'global');
      return { stations, count: stations.length };
    } catch (error) {
      console.error('[stationService] getPopularStations error:', error);
      throw error;
    }
  },

  // Get precomputed stations - direct API call
  async getPrecomputedStations(country?: string, countryName?: string, page: number = 1, limit: number = 33) {
    try {
      console.log('[stationService] getPrecomputedStations - country:', country);
      const response = await api.get(API_ENDPOINTS.stations.precomputed, {
        params: { country, page, limit },
      });
      return response.data;
    } catch (error) {
      console.error('[stationService] getPrecomputedStations error:', error);
      throw error;
    }
  },

  // Get nearby stations - direct API call
  async getNearbyStations(lat: number, lng: number, radius: number = 100, limit: number = 20) {
    try {
      console.log('[stationService] getNearbyStations - lat:', lat, 'lng:', lng);
      const response = await api.get(API_ENDPOINTS.stations.nearby, {
        params: { lat, lng, radius, limit },
      });
      return response.data;
    } catch (error) {
      console.error('[stationService] getNearbyStations error:', error);
      throw error;
    }
  },

  // Get similar stations - direct API call
  async getSimilarStations(stationId: string, limit: number = 12) {
    try {
      const response = await api.get(API_ENDPOINTS.stations.similar(stationId), {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('[stationService] getSimilarStations error:', error);
      throw error;
    }
  },

  // Search stations - direct API call
  async searchStations(query: string, limit: number = 20, signal?: AbortSignal): Promise<Station[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }
      
      console.log('[stationService] searchStations - query:', query);
      const response = await api.get(API_ENDPOINTS.stations.list, {
        params: { search: query, limit },
        signal,
      });
      
      const data = response.data;
      let stations: Station[] = [];
      
      if (data && data.stations) {
        stations = data.stations;
      } else if (Array.isArray(data)) {
        stations = data;
      }

      return stations;
    } catch (error) {
      console.error('[stationService] searchStations error:', error);
      throw error;
    }
  },

  // Get top 100 - direct API call
  async getTop100(country?: string): Promise<Station[]> {
    try {
      console.log('[stationService] getTop100 - country:', country);
      const response = await api.get(API_ENDPOINTS.discover.top100, {
        params: { country },
      });
      
      const data = response.data;
      let stations: Station[] = [];
      
      if (data && data.results) {
        stations = data.results;
      } else if (Array.isArray(data)) {
        stations = data;
      }

      return stations;
    } catch (error) {
      console.error('[stationService] getTop100 error:', error);
      throw error;
    }
  },

  // Get community favorites - direct API call
  async getCommunityFavorites(limit: number = 20): Promise<any[]> {
    try {
      const response = await api.get(API_ENDPOINTS.communityFavorites, {
        params: { limit },
      });
      return response.data || [];
    } catch (error) {
      console.error('[stationService] getCommunityFavorites error:', error);
      throw error;
    }
  },

  // Get public profiles - direct API call
  async getPublicProfiles(limit: number = 10): Promise<any[]> {
    try {
      const response = await api.get(API_ENDPOINTS.publicProfiles, {
        params: { limit },
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('[stationService] getPublicProfiles error:', error);
      throw error;
    }
  },

  getProxyUrl: streamService.proxyUrl,
  resolveStream: streamService.resolve,

  // Record click
  async recordClick(stationId: string) {
    try {
      const response = await api.post(API_ENDPOINTS.stations.click(stationId));
      return response.data;
    } catch (error) {
      console.error('[stationService] recordClick error:', error);
      return null;
    }
  },

  // Get now playing metadata
  async getNowPlaying(stationId: string) {
    try {
      const response = await api.get(API_ENDPOINTS.stations.nowPlaying(stationId));
      return response.data;
    } catch (error) {
      console.error('[stationService] getNowPlaying error:', error);
      return null;
    }
  },

  // Get diverse recommendations
  async getDiverseRecommendations(limit: number = 20, country?: string): Promise<{ stations: Station[] }> {
    try {
      const params: Record<string, any> = { limit };
      if (country) params.country = country;
      
      const response = await api.get(API_ENDPOINTS.recommendations.diverse, { params });
      return response.data;
    } catch (error) {
      console.error('[stationService] getDiverseRecommendations error:', error);
      return { stations: [] };
    }
  },
};

export default stationService;
