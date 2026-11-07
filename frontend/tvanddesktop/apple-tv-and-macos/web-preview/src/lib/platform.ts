/**
 * Platform detection for the TV/Desktop web core.
 *
 * The same Vite+React bundle ships inside multiple shells:
 *   - Tizen .wgt          → file:// origin, navigator.userAgent contains "tizen"
 *   - LG WebOS .ipk       → file:// origin, navigator.userAgent contains "webos"
 *   - Apple TV / tvOS     → WKWebView shell exposes window.webkit.messageHandlers.megaradio
 *   - Android TV          → WebView shell exposes window.MegaRadioNative
 *   - Electron desktop    → navigator.userAgent contains "electron"
 *   - Plain web preview   → none of the above
 *
 * The native shells inject a `window.MegaRadioPlatform` global at startup
 * with `{ platform: 'appletv' | 'androidtv' }` so we don't have to fingerprint
 * a UA string. We still fall back to UA sniffing for Tizen/WebOS where the
 * shell doesn't inject anything (the .wgt/.ipk just runs the HTML).
 */

export type TvPlatform =
  | 'tizen'
  | 'webos'
  | 'appletv'
  | 'androidtv'
  | 'electron'
  | 'web';

export function detectPlatform(): TvPlatform {
  if (typeof window !== 'undefined' && (window as any).megaRadioDesktop?.isDesktop) return 'electron';
  try {
    // 1. Native shell explicit announcement (preferred)
    const announced = (window as any).MegaRadioPlatform?.platform;
    if (announced === 'appletv' || announced === 'androidtv') return announced;

    // 2. Apple TV (WKWebView) auto-detect via webkit messageHandler
    if ((window as any).webkit?.messageHandlers?.megaradio) return 'appletv';

    // 3. Android TV auto-detect via injected JS interface
    if (typeof (window as any).MegaRadioNative?.invoke === 'function') return 'androidtv';

    // 4. UA-based fallbacks
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.indexOf('tizen') !== -1) return 'tizen';
    if ((window as any).webOS || (window as any).webOSSystem ||
        ua.indexOf('webos') !== -1 || ua.indexOf('web0s') !== -1) return 'webos';
    if (ua.indexOf('megaradioandroidtv') !== -1) return 'androidtv';
    if (ua.indexOf('electron') !== -1) return 'electron';

    return 'web';
  } catch {
    return 'web';
  }
}

export function supportsNativeIap(): boolean {
  const p = detectPlatform();
  return p === 'appletv' || p === 'androidtv';
}

export function isQrLinkOnlyPlatform(): boolean {
  // Tizen and WebOS forbid in-app billing → must use QR code account-linking.
  // Web preview also uses QR (developer convenience).
  const p = detectPlatform();
  return p === 'tizen' || p === 'webos' || p === 'web' || p === 'electron';
}

/** Only the signed Mac App Store shell; never a TV or Windows/Linux build. */
export function isMacAppStore(): boolean {
  const desktop = typeof window !== "undefined" && (window as any).megaRadioDesktop;
  return desktop?.isDesktop === true && desktop.platform === "darwin" && desktop.supportsNativeIap === true;
}
