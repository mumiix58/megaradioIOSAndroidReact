import stationService from './stationService';
import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import { queryClient } from './queryClient';
export async function searchCatalog(query: string, signal: AbortSignal) {
  const [stations, genres, profiles] = await Promise.all([
    stationService.searchStations(query, 30, signal),
    queryClient.fetchQuery({ queryKey: ['searchGenres'], staleTime: 60_000, queryFn: async () => (await api.get(API_ENDPOINTS.genres.discoverable)).data }),
    queryClient.fetchQuery({ queryKey: ['searchProfiles'], staleTime: 60_000, queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.publicProfiles, { params: { limit: 50 } });
      return response.data?.data || response.data || [];
    } }),
  ]);
  return { stations, genres, profiles };
}
