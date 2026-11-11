// Genre Service - Direct API calls without local caching
// All data is fetched fresh from API

import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { Genre, GenreResponse, Station } from '../types';

export const genreService = {
  // Get all genres - direct API call
  async getGenres(page: number = 1, limit: number = 50, country?: string, lang?: string): Promise<GenreResponse> {
    try {
      console.log('[genreService] getGenres - page:', page, 'country:', country);
      const response = await api.get(API_ENDPOINTS.genres.list, {
        params: { page, limit, country, lang },
      });
      return response.data;
    } catch (error) {
      console.error('[genreService] getGenres error:', error);
      throw error;
    }
  },

  // Get precomputed genres - direct API call
  async getPrecomputedGenres(country?: string, limit: number = 40): Promise<{ success: boolean; data: Genre[] }> {
    try {
      console.log('[genreService] getPrecomputedGenres - country:', country, 'limit:', limit);
      const response = await api.get(API_ENDPOINTS.genres.precomputed, {
        params: { country, tv: 1, limit },
      });
      console.log('[genreService] getPrecomputedGenres result:', response.data?.data?.length || 0, 'genres');
      return response.data;
    } catch (error) {
      console.error('[genreService] getPrecomputedGenres error:', error);
      throw error;
    }
  },

  // Get discoverable/featured genres - direct API call
  async getDiscoverableGenres(): Promise<Genre[]> {
    try {
      console.log('[genreService] getDiscoverableGenres - fetching from API');
      const response = await api.get(API_ENDPOINTS.genres.discoverable);
      const data = response.data;
      console.log('[genreService] getDiscoverableGenres result:', Array.isArray(data) ? data.length : 0, 'genres');
      return data || [];
    } catch (error) {
      console.error('[genreService] getDiscoverableGenres error:', error);
      throw error;
    }
  },

  // Get genre by slug - direct API call
  async getGenreBySlug(slug: string): Promise<Genre | null> {
    try {
      console.log('[genreService] getGenreBySlug - slug:', slug);
      const response = await api.get(API_ENDPOINTS.genres.bySlug(slug));
      return response.data;
    } catch (error) {
      console.error('[genreService] getGenreBySlug error:', error);
      throw error;
    }
  },

  /**
   * Get stations within a genre - with automatic country name fallback.
   * 
   * The genre stations API uses a direct DB match for the country field,
   * which is inconsistent:
   *   - Most countries: English name (e.g., "Austria", "Germany")
   *   - Turkey: Native name "Türkiye" (not "Turkey")
   * 
   * This function tries `countryEnglish` first, then falls back to
   * `countryNative` if the first attempt returns 0 stations.
   */
  async getGenreStations(
    slug: string,
    page: number = 1,
    limit: number = 25,
    countryEnglish?: string,
    sort?: 'votes' | 'name' | 'createdAt',
    order?: 'asc' | 'desc',
    countryNative?: string
  ): Promise<{ genre?: any; stations: Station[]; total?: number; page?: number; pages?: number; pagination?: any }> {
    try {
      console.log('[genreService] getGenreStations - slug:', slug, 'countryEnglish:', countryEnglish, 'countryNative:', countryNative);
      
      // CRITICAL: Never send country=undefined or country=null as string params
      // If country is falsy, omit it entirely so the API returns global results
      const safeCountry = countryEnglish && countryEnglish !== 'undefined' && countryEnglish !== 'null' 
        ? countryEnglish : undefined;
      const safeSortParam = sort || undefined;
      const safeOrderParam = order || undefined;
      
      // First attempt with the primary country name (usually English)
      const response = await api.get(API_ENDPOINTS.genres.stations(slug), {
        params: { page, limit, country: safeCountry, sort: safeSortParam, order: safeOrderParam },
      });
      
      const data = response.data;
      const stationCount = data?.stations?.length || 0;
      const totalCount = data?.total || 0;
      
      console.log('[genreService] getGenreStations result - stations:', stationCount, 'total:', totalCount);
      
      // If 0 results AND we have a different native name to try, retry with native name
      // This handles the Turkey case: English "Turkey" returns 0, native "Türkiye" returns results
      const safeNativeCountry = countryNative && countryNative !== 'undefined' && countryNative !== 'null' 
        ? countryNative : undefined;
      if (totalCount === 0 && safeNativeCountry && safeNativeCountry !== safeCountry) {
        console.log('[genreService] getGenreStations - 0 results, retrying with native name:', safeNativeCountry);
        
        const retryResponse = await api.get(API_ENDPOINTS.genres.stations(slug), {
          params: { page, limit, country: safeNativeCountry, sort: safeSortParam, order: safeOrderParam },
        });
        
        const retryData = retryResponse.data;
        console.log('[genreService] getGenreStations retry result - stations:', retryData?.stations?.length || 0, 'total:', retryData?.total || 0);
        
        if ((retryData?.total || 0) > 0) {
          return retryData;
        }
      }
      
      return data;
    } catch (error) {
      console.error('[genreService] getGenreStations error:', error);
      return { 
        stations: [], 
        pagination: { page, limit, total: 0, totalPages: 0 } 
      };
    }
  },
};

export default genreService;
