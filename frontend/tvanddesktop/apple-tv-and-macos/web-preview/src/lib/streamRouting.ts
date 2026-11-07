import { detectPlatform } from './platform';

/** Only the browser preview is served alongside FastAPI's stream helpers. */
export function usesPreviewStreamRoutes(): boolean {
  return detectPlatform() === 'web' && typeof window !== 'undefined' &&
    /^https?:$/.test(window.location.protocol) &&
    /(^|\.)preview\.emergentagent\.com$/i.test(window.location.hostname);
}

export function parseStationPlaylist(text: string, sourceUrl: string): string {
  if (/^\s*</.test(text)) return sourceUrl; // Error/login HTML is not a playlist.
  // HLS manifests belong to the player; never return a segment URL as a station.
  if (/^#EXT-X-/m.test(text)) return sourceUrl;
  for (const line of text.split(/\r?\n/)) {
    const entry = line.match(/^\s*File\d+\s*=\s*(.+)$/i)?.[1] || line.trim();
    if (!entry || entry.startsWith('#') || entry.startsWith('[') || /^[\w-]+=/.test(entry)) continue;
    try {
      const url = new URL(entry.trim(), sourceUrl);
      if (/^https?:$/.test(url.protocol)) return url.href;
    } catch { /* Try the next playlist entry. */ }
  }
  return sourceUrl;
}
/** Production stream service uses a base64url URL path, not the preview query endpoint. */
export function publicStreamProxyUrl(url: string): string {
  const bytes = encodeURIComponent(url).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return 'https://themegaradio.com/api/stream/' + btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function browserStreamUrl(url: string, force = false): string {
  if (detectPlatform() !== 'web' || typeof window === 'undefined') return url;
  if (!force && !(url.startsWith('http://') && window.location.protocol === 'https:')) return url;
  return usesPreviewStreamRoutes() ? `/api/stream-proxy?url=${encodeURIComponent(url)}` : publicStreamProxyUrl(url);
}
export function streamResolveEndpoint(url: string): string {
  const base = usesPreviewStreamRoutes() ? '/api/stream-resolve' : 'https://themegaradio.com/api/stream/resolve';
  return `${base}?url=${encodeURIComponent(url)}`;
}
export function resolvedStreamResponse(data: any, original: string): { resolvedUrl: string; isPlaylist: boolean; isHLS: boolean; error?: string } {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const first = candidates.find((candidate: unknown) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate));
  const resolved = first || data.resolvedUrl || data.final_url || original;
  const safe = typeof resolved === 'string' && /^https?:\/\//i.test(resolved) ? resolved : original;
  return { resolvedUrl: safe, isPlaylist: data.isPlaylist === true || /\.(pls|m3u)(?:[?#]|$)/i.test(safe), isHLS: data.playlistType === 'hls' || data.isHLS === true, error: typeof data.error === 'string' ? data.error : undefined };
}

export function isBrowserAutoplayBlock(error: any): boolean {
  return detectPlatform() === 'web' && error?.name === 'NotAllowedError';
}
