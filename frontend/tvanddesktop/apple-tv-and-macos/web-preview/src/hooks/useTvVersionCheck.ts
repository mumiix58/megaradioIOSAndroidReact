import { getProductionApiOrigin } from '../lib/apiOrigin';
/**
 * Update Banner — TV / Desktop için "yeni sürüm var" bildirimi.
 *
 * Backend kontratı:
 *   GET https://api.themegaradio.com/api/tv/version
 *   Response 200:
 *   {
 *     "latest":     { "tizen": "1.0.3", "webos": "1.0.3", "ios": "5.4.3", ... },
 *     "minimum":    { "tizen": "1.0.0", "webos": "1.0.0", ... },  // optional — bunun altı force-update
 *     "releaseNotes": { "tr": "...", "en": "..." },                // optional
 *     "storeUrl": {
 *        "tizen": "https://www.samsung.com/...",
 *        "webos": "https://www.lgcontent.lge.com/...",
 *        "desktop": "https://github.com/.../releases/latest"
 *     }
 *   }
 *
 * Davranış:
 *   • Şu anki versiyon `latest`'in altındaysa → soft banner (kapatılabilir, 7 günde bir hatırlatır)
 *   • Şu anki versiyon `minimum`'un altındaysa → blocking modal (kapatılamaz)
 *   • Backend 404/timeout → sessizce devam (uygulamayı bloklamaz)
 */
import { useEffect, useState } from 'react';

type Platform = 'tizen' | 'webos' | 'ios' | 'tvos' | 'macos' | 'android' | 'androidtv' | 'desktop' | 'web';
type VersionResponse = {
  latest?: Partial<Record<Platform, string>>;
  minimum?: Partial<Record<Platform, string>>;
  releaseNotes?: { tr?: string; en?: string };
  storeUrl?: Partial<Record<Platform, string>>;
};

const VERSION_ENDPOINT = getProductionApiOrigin() + '/api/tv/version';
const DISMISS_KEY = 'mr_update_dismissed_at';
const SOFT_REMIND_DAYS = 7;

function detectPlatform(): Platform {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (ua.includes('tizen')) return 'tizen';
  if (ua.includes('web0s') || ua.includes('webos')) return 'webos';
  // Electron exposes window.megaRadioDesktop (see desktop/electron/preload.js)
  if (typeof window !== 'undefined' && (window as any).megaRadioDesktop?.isDesktop) return 'desktop';
  return 'web';
}

// CDN releases have IDs such as gha-<run>-<sha>. They are not store versions.
function packageVersion(value: unknown): string | null {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
}

async function getCurrentVersion(platform: Platform): Promise<string | null> {
  if (platform === 'tizen') {
    try {
      return packageVersion((window as any).tizen.application.getCurrentApplication().appInfo.version);
    } catch { return null; }
  }
  if (platform === 'webos') {
    // Read the installed IPK metadata, never the CDN's build or version.json.
    // The bootstrap is /index.html; the bundled fallback is /app/index.html.
    if (window.location.protocol !== 'file:') return null;
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      try {
        const relative = /\/app\/index\.html$/.test(window.location.pathname)
          ? '../appinfo.json' : './appinfo.json';
        xhr.open('GET', new URL(relative, window.location.href).href, true);
        xhr.timeout = 4000;
        xhr.onload = () => {
          try {
            resolve((xhr.status === 0 || xhr.status === 200)
              ? packageVersion(JSON.parse(xhr.responseText).version) : null);
          } catch { resolve(null); }
        };
        xhr.onerror = xhr.ontimeout = xhr.onabort = () => resolve(null);
        xhr.send();
      } catch { resolve(null); }
    });
  }
  return packageVersion((import.meta as any).env?.VITE_APP_VERSION);
}

function isOlder(current: string, target: unknown): boolean {
  const valid = packageVersion(target);
  if (!valid) return false;
  const pa = current.split('.').map(Number);
  const pb = valid.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i];
  }
  return false;
}

type UpdateState =
  | { kind: 'none' }
  | { kind: 'soft'; latest: string; storeUrl?: string; notes?: string }
  | { kind: 'forced'; latest: string; minimum: string; storeUrl?: string; notes?: string };

export function useTvVersionCheck(): UpdateState {
  const [state, setState] = useState<UpdateState>({ kind: 'none' });

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(VERSION_ENDPOINT, { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;
        const data: VersionResponse = await res.json();
        if (aborted) return;

        const platform = detectPlatform();
        const current = await getCurrentVersion(platform);
        if (aborted || !current) return;
        const latest = data.latest?.[platform];
        const minimum = data.minimum?.[platform];
        // TV window.open can replace the native app with a website. For a real
        // package update, instruct users to open the TV store themselves.
        const storeUrl = platform === 'tizen' || platform === 'webos'
          ? undefined : data.storeUrl?.[platform];
        const lang = (typeof navigator !== 'undefined' && navigator.language?.startsWith('tr')) ? 'tr' : 'en';
        const notes = data.releaseNotes?.[lang as 'tr' | 'en'];

        // Force update?
        if (minimum && isOlder(current, minimum)) {
          setState({ kind: 'forced', latest: latest || minimum, minimum, storeUrl, notes });
          return;
        }
        // Soft update?
        if (latest && isOlder(current, latest)) {
          // Respect 7-day dismiss cooldown for soft banner
          const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
          const ageDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
          if (ageDays < SOFT_REMIND_DAYS && dismissedAt > 0) return;
          setState({ kind: 'soft', latest, storeUrl, notes });
        }
      } catch {
        // network/parse error — fail silent
      }
    })();
    return () => { aborted = true; };
  }, []);

  return state;
}

export function dismissSoftUpdate() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}
