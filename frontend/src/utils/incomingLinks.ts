import Constants from 'expo-constants';
import { localizedRouteKind } from './localizedRoutes';

/** Pure routing: no fetching, playback, auth changes or new Linking subscriber. */
export function incomingLinkPath(path: string): string {
  try {
    const url = new URL(path, 'megaradio://app');
    const configuredHost = new URL(Constants.expoConfig?.extra?.websiteUrl).hostname;
    const isWebsite = url.protocol === 'https:' && url.hostname === configuredHost;
    const isApp = url.protocol === 'megaradio:';
    if (!isWebsite && !isApp) return path; // OAuth and all foreign links untouched.
    // URL() normalizes /a/../b before exposing pathname. Validate the ORIGINAL
    // path so malformed shared links cannot silently turn into another route.
    const originalPath = path.split(/[?#]/)[0].replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
    for (const part of originalPath.split('/')) {
      let decoded = part;
      for (let pass = 0; pass < 2; pass++) {
        decoded = decodeURIComponent(decoded);
        if (decoded === '.' || decoded === '..' || /[\\/\u0000-\u001f]/.test(decoded)) return '/link-error';
      }
    }
    if (isApp && (url.searchParams.has('playLast') || url.hostname === 'play')) return path;
    const parts = url.pathname.split('/').filter(Boolean);
    if (isApp && ['station', 'user', 'profile', 'genre'].includes(url.hostname)) parts.unshift(url.hostname);
    // Website canonical redirects can include a language prefix, e.g. /tr/station/x.
    const language = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0] || '') ? parts.shift()!.toLowerCase().split('-')[0] : 'en';
    const [segment, raw] = parts;
    const kind = localizedRouteKind(decodeURIComponent(segment || ''), language);
    if (!kind) return path;
    if (!raw || parts.length !== 2) return '/link-error';
    const identifier = decodeURIComponent(raw).trim();
    if (!identifier || /[\/?#\u0000-\u001f]/.test(identifier)) return '/link-error';
    if (kind === 'genre') return `/genre-detail?slug=${encodeURIComponent(identifier)}`;
    return `/open-link?type=${kind === 'station' ? 'station' : 'user'}&identifier=${encodeURIComponent(identifier)}`;
  } catch { return '/link-error'; }
}