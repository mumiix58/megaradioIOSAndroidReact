export function profileAvatar(profile: any, routeAvatar?: string) {
  const candidates = [profile?.profileImageUrl, profile?.profilePhoto, profile?.avatar, routeAvatar];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const uri = candidate.trim();
    if (/^https?:\/\//i.test(uri)) return uri;
    if (uri.startsWith('/')) return `https://themegaradio.com${uri}`;
  }
  return null;
}
export function favoriteSubtitle(station: any): string {
  const raw = Array.isArray(station.genres) && station.genres.length ? station.genres
    : typeof station.genre === 'string' && station.genre.trim() ? [station.genre]
    : typeof station.tags === 'string' ? [station.tags] : [];
  return raw.flatMap((value: string) => typeof value === 'string' ? value.split(',') : [])
    .map((value: string) => value.trim()).filter(Boolean).slice(0, 2).join(', ') || 'Radio';
}
export function profileCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

/** Votes use one compact K suffix, without a translated "votes" label. */
export function compactProfileVotes(value:number):string {
 const count=Math.max(0,Math.floor(Number.isFinite(value)?value:0));
 return count>=1000?`${(count/1000).toFixed(1).replace(/\.0$/,'')}K`:String(count);
}
