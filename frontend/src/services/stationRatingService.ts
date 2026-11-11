import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import api from './api';
import { API_ENDPOINTS } from '../constants/api';

export interface StationRating { rating: number; comment?: string; stationId?: string; station_id?: string }
export interface StationRatingStats { averageRating: number; totalRatings: number; votes?: number }
let session: Promise<string> | undefined;
export const ratingSessionId = () => session ??= (async () => {
  try { const saved = await AsyncStorage.getItem('@megaradio_rating_session'); if (saved) return saved; } catch { /* Keep a stable in-memory identity if storage is unavailable. */ }
  const id = `mobile_${Crypto.randomUUID()}`;
  try { await AsyncStorage.setItem('@megaradio_rating_session', id); } catch { /* Memory identity is still usable. */ }
  return id;
})();
export const assertRatingStats = (stats: StationRatingStats) => {
  if (!stats || !Number.isInteger(stats.totalRatings) || stats.totalRatings < 0 || !Number.isFinite(stats.averageRating) || stats.averageRating < 0 || stats.averageRating > 5 || (stats.totalRatings === 0 && stats.averageRating !== 0)) throw new Error('Invalid rating statistics');
};
const assertScope = (rating: StationRating | null, id: string) => {
  const owner = rating?.stationId ?? rating?.station_id;
  if (owner && owner !== id) throw new Error('Rating belongs to another station');
  if (rating && (!Number.isInteger(rating.rating) || rating.rating < 1 || rating.rating > 5)) throw new Error('Invalid saved rating');
};
export const stationRatingService = {
  async stats(id: string): Promise<StationRatingStats> {
    const { data } = await api.get(API_ENDPOINTS.stations.ratings(id), { params: { limit: 1 } });
    assertRatingStats(data.stats);
    return data.stats;
  },
  async userRating(id: string, sessionId: string): Promise<StationRating | null> {
    const { data } = await api.get(API_ENDPOINTS.stations.userRating(id), { params: { sessionId } });
    if (!data || !('rating' in data)) throw new Error('Invalid user rating response');
    assertScope(data.rating, id);
    return data.rating;
  },
  async submit(id: string, sessionId: string, rating: number, comment?: string): Promise<{ rating: StationRating; stats: StationRatingStats }> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Invalid rating');
    // The authenticated identity comes from the existing API bearer interceptor.
    const { data } = await api.post(API_ENDPOINTS.stations.rate(id), { rating, comment, sessionId });
    if (data.success === false || !data.rating) throw new Error('Rating was not saved');
    assertScope(data.rating, id); assertRatingStats(data.stats);
    return data;
  },
};
