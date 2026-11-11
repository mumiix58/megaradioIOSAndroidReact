import { stationSearchRequests, stationSearchLocation, rankStationSearch, stationSearchGenre, rankGenreStations, registerStationSearchGenres } from '../utils/stationSearch';
import { nearbyScope } from '../utils/nearbyScope';
// Station Service - Direct API calls without local caching
// All data is fetched fresh from API

import api from './api';
import {CanceledError} from 'axios';
import { API_ENDPOINTS, API_BASE_URL } from '../constants/api';
import type { Station } from '../types';

export interface StationQueryParams {
  page?: number;
  limit?: number;
  country?: string;
  genre?: string;
  search?: string;
  sort?: 'votes' | 'az' | 'za' | 'clickCount' | 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

// One shared taxonomy cache, never per-image probes in search.
let genreCatalogRequest: Promise<void> | undefined;
let genreCatalogUpdated=0;
function warmSearchGenres():Promise<void> {
 if(genreCatalogRequest)return genreCatalogRequest;
 if(Date.now()-genreCatalogUpdated<300000)return Promise.resolve();
 genreCatalogRequest=api.get('/api/genres',{params:{limit:500,page:1},timeout:3000}).then(({data})=>{
  registerStationSearchGenres(Array.isArray(data)?data:data?.genres||data?.data||[]);genreCatalogUpdated=Date.now();
 }).catch(()=>{}).finally(()=>{genreCatalogRequest=undefined;});
 return genreCatalogRequest;
}
export const stationService = {
  async voteStation(id: string): Promise<{ success: true; votes: number; alreadyVoted: boolean; hasVoted: boolean }> {
    const { data } = await api.post(API_ENDPOINTS.stations.vote(id));
    if (data?.success !== true || typeof data.votes !== 'number' || !Number.isFinite(data.votes) || data.votes < 0) throw new Error('Invalid vote response');
    return data;
  },
  async voteState(id: string): Promise<{votes: number; hasVoted: boolean}> {
    const {data} = await api.get(API_ENDPOINTS.stations.vote(id));
    if (typeof data?.hasVoted !== 'boolean' || !Number.isFinite(data?.votes)) throw new Error('Invalid vote state');
    return data;
  },
  // Get single station by identifier (slug or id)
  async getStation(identifier: string): Promise<Station | null> {
    try {
      const response = await api.get(API_ENDPOINTS.stations.single(identifier));
      return response.data;
    } catch (error) {
      console.error('[stationService] getStation error:', error);
      return null;
    }
  },

  // Get list of stations - direct API call
  async getStations(params: StationQueryParams = {}, signal?: AbortSignal): Promise<{ stations: Station[]; totalCount: number }> {
    if (params.search?.trim()) {
      const matches = await stationService.searchStations(params.search, 500, signal, { country: params.country, genre: params.genre });
      const page = Math.max(1, Math.floor(params.page || 1));
      const limit = Math.min(500, Math.max(1, Math.floor(params.limit || 25)));
      return { stations: matches.slice((page - 1) * limit, page * limit), totalCount: matches.length };
    }
    try {
      console.log('[stationService] getStations - params:', params);
      const response = await api.get(API_ENDPOINTS.stations.list, { params, signal });
      return response.data;
    } catch (error) {
      console.error('[stationService] getStations error:', error);
      return { stations: [], totalCount: 0 };
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
      return { stations: [], count: 0 };
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
      return { stations: [], totalCount: 0, page: 1, limit, totalPages: 0 };
    }
  },

  // Get nearby stations - direct API call
  async getNearbyStations(lat: number | null, lng: number | null, radius: number = 100, limit: number = 20, country?: string) {
    try {
      const scope = nearbyScope(lat, lng, country);
      if (!scope.enabled) return [];
      const response = await api.get(API_ENDPOINTS.stations.nearby, {
        params: { ...scope.params, radius, limit, slim: 1 },
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
      return [];
    }
  },

  // Search stations - direct API call
  async searchStations(query: string, limit: number = 20, signal?: AbortSignal, scope: {country?: string; genre?: string} = {}): Promise<Station[]> {
    const searches=stationSearchRequests(query);
    if(!searches.length)return [];
    const outputLimit=Number.isFinite(limit)?Math.min(500,Math.max(1,Math.floor(limit))):20;
    const candidateLimit=Math.min(500,Math.max(60,outputLimit*3));
    const knownGenre=stationSearchGenre(query);
    const taxonomy=warmSearchGenres();
    if(knownGenre && (!scope.genre || stationSearchGenre(scope.genre)===knownGenre || scope.genre===knownGenre)) {
      const {data}=await api.get(API_ENDPOINTS.stations.search,{params:{countryName:scope.country,countryCode:scope.country?undefined:'global',genre:knownGenre,sort:'votes',limit:candidateLimit,slim:1},signal,timeout:5000});
      if(signal?.aborted)throw new CanceledError('Search cancelled');
      return rankGenreStations(Array.isArray(data)?data:data?.stations||data?.data||[],knownGenre,outputLimit,true);
    }
    // This existing public reader preserves literal names (no destructive synonym rewrite).
    // Compact payloads + cancellation keep typeahead light, including the compatibility path.
    const requests=searches.map(search=>api.get(API_ENDPOINTS.stations.search,{
      params:{countryName:scope.country,countryCode:scope.country?undefined:'global',genre:scope.genre,search,sort:'votes',limit:candidateLimit,slim:1},signal,timeout:5000,
    }));
    const location=stationSearchLocation(query);
    if(location)requests.push(api.get(API_ENDPOINTS.stations.list,{
      params:{state:location,country:scope.country,countryName:scope.country,genre:scope.genre,sort:'votes',limit:candidateLimit,slim:1},signal,timeout:5000,
    }));
    const responses=await Promise.allSettled(requests);
    if(signal?.aborted)throw new CanceledError('Search cancelled');
    const fulfilled=responses.filter((result):result is PromiseFulfilledResult<any>=>result.status==='fulfilled');
    if(!fulfilled.length)throw (responses[0] as PromiseRejectedResult).reason;
    const stations=fulfilled.flatMap(({value:{data}})=>Array.isArray(data)?data:Array.isArray(data?.stations)?data.stations:Array.isArray(data?.data)?data.data:[]);
    // Cold uncommon category names resolve against the shared catalog while name reads run.
    await taxonomy;
    const discoveredGenre=stationSearchGenre(query);
    if(discoveredGenre && (!scope.genre || stationSearchGenre(scope.genre)===discoveredGenre || scope.genre===discoveredGenre)) {
      const {data}=await api.get(API_ENDPOINTS.stations.search,{params:{countryName:scope.country,countryCode:scope.country?undefined:'global',genre:discoveredGenre,sort:'votes',limit:candidateLimit,slim:1},signal,timeout:5000});
      if(signal?.aborted)throw new CanceledError('Search cancelled');
      return rankGenreStations(Array.isArray(data)?data:data?.stations||data?.data||[],discoveredGenre,outputLimit,true);
    }
    return rankStationSearch(stations,query,outputLimit);
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
      return [];
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
      return [];
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
      return [];
    }
  },

  // Get proxy URL
  getProxyUrl(url: string): string {
    const encodedUrl = encodeURIComponent(url);
    return `${API_BASE_URL}${API_ENDPOINTS.stream.proxy(encodedUrl)}`;
  },

  // Resolve stream
  async resolveStream(url: string) {
    try {
      const response = await api.get(API_ENDPOINTS.stream.resolve, {
        params: { url },
      });
      return response.data;
    } catch (error) {
      console.error('[stationService] resolveStream error:', error);
      return null;
    }
  },

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
