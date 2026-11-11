import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ratingSessionId, stationRatingService, StationRating, StationRatingStats } from '../services/stationRatingService';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from './useQueries';
import type { Station } from '../types';

export const stationRatingKeys = (id: string, user: string, session: string) => ({
  user: ['station-rating', id, user || 'anonymous', session] as const,
  stats: ['station-rating-stats', id] as const,
});
export function useStationRatings(id: string) {
  const client = useQueryClient();
  const userId = useAuthStore(state => state.user?._id || '');
  const [session, setSession] = useState('');
  useEffect(() => { let active = true; void ratingSessionId().then(value => { if (active) setSession(value); }); return () => { active = false; }; }, []);
  const keys = stationRatingKeys(id, userId, session);
  const stats = useQuery({ queryKey: keys.stats, queryFn: () => stationRatingService.stats(id), enabled: !!id, staleTime: 120000, retry: false });
  const own = useQuery({ queryKey: keys.user, queryFn: () => stationRatingService.userRating(id, session), enabled: !!id && !!session, staleTime: 300000, retry: false });
  const submit = async (rating: number) => {
    if (!session || own.isPending || own.isError) throw new Error('Rating identity is not ready');
    const result = await stationRatingService.submit(id, session, rating, own.data?.comment);
    await Promise.all([client.cancelQueries({ queryKey: keys.user, exact: true }), client.cancelQueries({ queryKey: keys.stats, exact: true })]);
    client.setQueryData<StationRating | null>(keys.user, result.rating);
    client.setQueryData<StationRatingStats>(keys.stats, result.stats);
    client.setQueryData<Station | null>(queryKeys.station(id), old => old ? { ...old, averageRating: result.stats.averageRating, totalRatings: result.stats.totalRatings, ...(typeof result.stats.votes === 'number' ? { votes: result.stats.votes } : {}) } : old);
    return result;
  };
  return { stats, own, submit, scope: `${id}:${userId}:${session}` };
}
