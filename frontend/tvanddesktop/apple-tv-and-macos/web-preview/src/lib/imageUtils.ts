import { getProductionApiOrigin } from './apiOrigin';
const IMAGE_API_BASE = getProductionApiOrigin();

// Backend HTTPS icon-proxy — upgrades legacy http://…/favicon.png URLs to
// https://…/api/tv-icon-proxy?url=… so Chrome/Electron don't fire Mixed-Content
// warnings when we embed them in <img>.
//
// IMPORTANT: under file:// (Tizen .wgt / WebOS .ipk / Apple TV WKWebView),
// `window.location.origin` is the empty string OR "file://", neither of
// which can serve our backend. Force the absolute production host in that
// case. Same `detectApiBase()` logic AuthContext / useSubscriptionLink use.
// On a packaged TV (.wgt / .ipk) or Apple TV WKWebView the document runs from
// `file://` (origin is "" / "null"). In that context there is NO mixed-content
// restriction, and the Tizen/webOS CSP already allows `img-src http:`, so we can
// (and MUST) load legacy `http://` station favicons DIRECTLY. The production
// `api.themegaradio.com` does NOT expose `/api/tv-icon-proxy` (returns 404), so
// routing through it is exactly why station logos were missing on real TVs.
const isFileContext = (() => {
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  return protocol === 'file:' || !window.location.origin || window.location.origin === 'null';
})();

// Only used on https web/preview/Electron, where a same-origin proxy actually
// exists (Emergent backend) and mixed-content would otherwise warn.
const ICON_PROXY = (() => {
  if (typeof window === 'undefined' || isFileContext) {
    return IMAGE_API_BASE + '/api/tv-icon-proxy?url=';
  }
  return `${window.location.origin}/api/tv-icon-proxy?url=`;
})();

export function resolveStationImageUrl(favicon: string | undefined | null): string | null {
  if (!favicon || favicon === 'null' || favicon.trim() === '') return null;

  // Inline data URIs (base64 logos) are already self-contained — return as-is.
  // Previously these were prefixed with /api/image/ → guaranteed 404 on TV.
  if (favicon.startsWith('data:')) return favicon;

  if (favicon.startsWith('http://')) {
    // Packaged TV (file://): load the http favicon directly — no proxy needed,
    // no mixed-content under file://, and the production proxy is 404 anyway.
    if (isFileContext) return favicon;
    // Web/Electron https: upgrade insecure origins through the backend icon-proxy.
    return ICON_PROXY + encodeURIComponent(favicon);
  }
  // Keep first-party absolute logo URLs on the same validated API alias too.
  if (favicon.startsWith('https://api.themegaradio.com/')) {
    return IMAGE_API_BASE + favicon.slice('https://api.themegaradio.com'.length);
  }
  if (favicon.startsWith('https://')) return favicon;

  // Relative favicon path. On packaged TV the /api/image/ route is also absent
  // upstream; there's nothing better to do than hand it to the catalog host.
  return IMAGE_API_BASE + '/api/image/' + encodeURIComponent(favicon);
}

// Shared <img> onError chain for station logos:
//   1) primary src (S3 logo) failed → try the raw favicon (`faviconFallback`)
//   2) that failed too → swap to the local fallback-station image
// Tracks progress on the element's dataset so each step only runs once.
export function handleStationImageError(
  e: { currentTarget?: HTMLImageElement; target?: EventTarget | null },
  faviconFallback: string | undefined | null,
  fallbackImage: string,
): void {
  const img = (e.currentTarget || e.target) as HTMLImageElement | null;
  if (!img) return;

  // Step 1 — try the original favicon once (only when the S3 logo was primary).
  if (!img.dataset.fbStep && faviconFallback) {
    img.dataset.fbStep = 'favicon';
    const resolved = resolveStationImageUrl(faviconFallback);
    if (resolved && resolved !== img.src) {
      img.src = resolved;
      return;
    }
  }

  // Step 2 — local fallback image (final).
  img.dataset.fbStep = 'fallback';
  // src resolves relative file paths to absolute URLs, while the attribute keeps
  // the assigned path. Compare both so a failed local fallback is not reloaded
  // by every subsequent error; a reused element with a new source can still fall back.
  if (img.src !== fallbackImage && img.getAttribute('src') !== fallbackImage) img.src = fallbackImage;
}
