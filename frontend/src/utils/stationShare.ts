import i18n from 'i18next';
import { localizedSharePath } from './localizedRoutes';
import type { Station } from '../types';
import Constants from 'expo-constants';
import { stationService } from '../services/stationService';

export class StationShareUnavailableError extends Error {
  constructor() {
    super('Bu radyonun web paylaşım sayfası şu anda kullanılamıyor. Lütfen başka bir radyo seçin.');
    this.name = 'StationShareUnavailableError';
  }
}

/** Only explicit 404/410 means unavailable. noIndex/offline-stream != deleted page. */
async function validateSharePage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 404 || response.status === 410) throw new StationShareUnavailableError();
  } catch (error) {
    if (error instanceof StationShareUnavailableError) throw error;
    // A timeout, no connection, HEAD unsupported or web CORS cannot prove that
    // a valid cached link is gone. Do not relabel it or invent another station.
  } finally {
    clearTimeout(timer);
  }
  return url;
}

export function stationShareUrl(station: Pick<Station, 'slug'>): string | null {
  const slug = typeof station.slug === 'string' ? station.slug.trim() : '';
  if (!slug) return null;
  const website = Constants.expoConfig?.extra?.websiteUrl;
  if (typeof website !== 'string' || !website.startsWith('https://')) return null;
  return `${website.replace(/\/$/, '')}${localizedSharePath('stations', slug, i18n.language || 'en')}`;
}

/** Older favorites/history may lack slug. Retrieve it, never invent a name slug. */
export async function resolveStationShareUrl(station: Station): Promise<string> {
  const cached = stationShareUrl(station);
  if (cached) return validateSharePage(cached);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const detail = await Promise.race([
      stationService.getStation(station._id),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000); }),
    ]);
    const url = detail && stationShareUrl(detail);
    if (!url) throw new Error('Paylaşım bağlantısı hazırlanamadı. Lütfen tekrar deneyin.');
    return await validateSharePage(url);
  } finally {
    clearTimeout(timer);
  }
}

export function stationShareContent(station: Station, url: string, song?: string) {
  return {
    title: `${station.name} - MegaRadio`,
    // One URL in message only. iOS url + message duplicates links in WhatsApp.
    message: `${station.name}${song ? ` - ${song}` : ''}\nMegaRadio'da dinle: ${url}`,
  };
}