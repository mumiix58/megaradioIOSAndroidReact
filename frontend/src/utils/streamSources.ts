/** Keep the actually played URL at index zero: failover starts at index one. */
export function buildStreamCandidates(primary: unknown, ...backups: unknown[]): string[] {
  return [...new Set([primary, ...backups].flat().filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0
  ).map(url => url.trim()))];
}

/** API records use camelCase, while older favorites use snake_case. */
export function getStationStreamUrl(station: {
  streamUrl?: string; urlResolved?: string; url_resolved?: string; url?: string;
}): string {
  return buildStreamCandidates(station.streamUrl, station.urlResolved,
    station.url_resolved, station.url)[0] || '';
}

export function isPlaylistStream(url: string | undefined): boolean {
  // Signed/parameterized playlists still need resolution.
  return typeof url === 'string' && /\.(pls|m3u8?|asx)(?:[?#]|$)/i.test(url);
}
/** HLS can use an extensionless URL or .m3u, as KRAL POP does in our API. */
export function isHlsStream(url: string, station?: {
  hls?: boolean; url?: string; urlResolved?: string; url_resolved?: string;
  streamUrl?: string; urlHigh?: string; urlLow?: string;
}): boolean {
  if (/\.m3u8(?:[?#]|$)/i.test(url)) return true;
  if (station?.hls !== true) return false;
  return /\.m3u(?:[?#]|$)/i.test(url) || [station.url, station.urlResolved,
    station.url_resolved, station.streamUrl, station.urlHigh, station.urlLow].includes(url);
}
