import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { DEFAULT_STATION_LOGO_URL, getStationLogoUrl } from '../utils/stationLogoHelper';
import { isPlaylistStream } from '../utils/streamSources';
import { usePremiumStore } from '../store/premiumStore';
import { probeRadioStream } from './radioStreamProbe';
import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { Station } from '../types';

export function eligibleWorldRadio(station: Station): boolean {
  const logo = getStationLogoUrl(station, 'large');
  if (!logo || logo.split(/[?#]/)[0].replace(/\/$/, '') === DEFAULT_STATION_LOGO_URL) return false;
  if (/\/(?:default[-_]?station[-_]?logo|placeholder)(?:\.[a-z]+)?(?:[?#]|$)/i.test(logo)) return false;
  const health = station.lastCheckOk ?? (station as any).lastcheckok;
  return health !== false && health !== 0 && health !== '0';
}
function verifiedLogo(uri: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    let done = false;
    const finish = (valid: boolean) => { if (done) return; done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(valid); };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), 3500);
    signal.addEventListener('abort', abort, { once: true });
    void Image.prefetch(uri, { cachePolicy: 'memory-disk' }).then(ok => finish(ok === true), () => finish(false));
  });
}
/** Artwork-only warmup: shares CarPlay checks without opening or probing a stream. */
export function verifyWorldRadioArtwork(station:Station,signal:AbortSignal):Promise<boolean>{
  return eligibleWorldRadio(station)&&!signal.aborted?verifiedLogo(getStationLogoUrl(station,'large')!,signal):Promise.resolve(false);
}
/** Returns the exact tested URL so playback cannot accidentally choose an untested alternative. */
export async function verifyWorldRadio(station: Station, signal: AbortSignal): Promise<Station | null> {
  if (!eligibleWorldRadio(station) || signal.aborted) return null;
  if (!await verifiedLogo(getStationLogoUrl(station, 'large')!, signal)) return null;
  const hd = usePremiumStore.getState().hasFeature('hd_stream');
  const raw = station as Station & { urlHigh?: string; urlLow?: string; url_high?: string; url_low?: string };
  let url = Platform.OS === 'web' ? station.urlResolved || station.url_resolved || station.url : hd ? raw.urlHigh || raw.url_high || station.urlResolved || station.url_resolved || station.url : raw.urlLow || raw.url_low || station.url || station.urlResolved || station.url_resolved;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    if (isPlaylistStream(url)) {
      const { data } = await api.get(API_ENDPOINTS.stream.resolve, { params: { url }, signal, timeout: 3000 });
      url = data?.candidates?.find((candidate: unknown) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) || '';
    }
    if (!url || !await probeRadioStream(url, signal) || signal.aborted) return null;
    return { ...station, url, urlResolved: url, url_resolved: url, ...(hd ? { urlHigh: url } : { urlLow: url }) };
  } catch { return null; }
}

/** Two bounded workers; first successful verification wins and stops the other decoder. */
export function firstVerifiedRadio(candidates: Station[], signal: AbortSignal, verify = verifyWorldRadio): Promise<Station | null> {
  if (!candidates.length || signal.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    const group = new AbortController();
    let cursor = 0, workers = Math.min(2, candidates.length), settled = false;
    const finish = (station: Station | null) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); group.abort(); resolve(station); };
    const abort = () => finish(null);
    signal.addEventListener('abort', abort, { once: true });
    const work = async () => {
      try {
        while (!settled && cursor < candidates.length) {
          const candidate = candidates[cursor++];
          let station: Station | null = null;
          try { station = await verify(candidate, group.signal); } catch { /* Try the next candidate. */ }
          if (station && !settled) { finish(station); return; }
        }
      } finally { workers--; if (!workers) finish(null); }
    };
    for (let i = 0, count = workers; i < count; i++) void work();
  });
}
