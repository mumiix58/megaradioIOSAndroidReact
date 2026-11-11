import type { Station } from '../types';
type FavoriteSort = 'newest' | 'oldest' | 'az' | 'za' | 'custom';
// Use the date the user favorited a station, never the station's creation date.
export function sortFavoriteStations(items: Station[], order: string[], sort: FavoriteSort): Station[] {
  const result = [...items];
  if (sort === 'az' || sort === 'za') return result.sort((a, b) => (sort === 'az' ? 1 : -1) * (a.name || '').toLocaleLowerCase().localeCompare((b.name || '').toLocaleLowerCase()));
  if (sort === 'custom') {
    const positions = new Map(order.map((id, index) => [id, index]));
    return result.sort((a, b) => (positions.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b._id) ?? Number.MAX_SAFE_INTEGER));
  }
  const timestamp = (station: Station) => {
    const value = (station as any).addedAt ?? (station as any).favoritedAt;
    const time = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : null;
  };
  // Legacy local favorites have no date; the API/local list is newest first.
  if (sort === 'oldest') result.reverse();
  return result.sort((a, b) => {
    const left = timestamp(a), right = timestamp(b);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (sort === 'newest' ? -1 : 1) * (left - right);
  });
}
export function moveFavorite<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
