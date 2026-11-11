import type { Station } from '../types';
export type RecentStation = Station & { playedAt?: string | null };
const playedTime = (station: RecentStation) => {
  const time = Date.parse(station.playedAt || '');
  return Number.isFinite(time) ? time : 0;
};
/** Newest actual play wins, irrespective of local/server response arrival order. */
export function mergeRecentlyPlayed(...lists: unknown[]): RecentStation[] {
  const byId = new Map<string, RecentStation>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const station of list) {
      if (!station || typeof station._id !== 'string' || !station._id || typeof station.name !== 'string') continue;
      const previous = byId.get(station._id);
      if (!previous || playedTime(station) > playedTime(previous)) byId.set(station._id, station);
    }
  }
  return [...byId.values()].sort((a,b) => playedTime(b)-playedTime(a)).slice(0,12);
}
