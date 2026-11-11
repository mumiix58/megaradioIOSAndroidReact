import api from './api';
import { loadWorldRadioHistory, worldCountryRotation, worldRadioHistory } from './worldRadioHistory';
import { worldCountryKeys } from '../utils/worldCountryRotation';
import { worldRadioKeys } from '../utils/worldRadioHistory';
import { API_ENDPOINTS } from '../constants/api';
import { eligibleWorldRadio, firstVerifiedRadio } from './worldRadioValidation';
import type { Station } from '../types';
import { isGlobalCountry } from '../utils/countryScope';
import { shuffledRadios, uniqueRadios, type RadioPage } from '../utils/carRadioFeed';

export async function getCarRadioPage(page: number, country?: string, signal?: AbortSignal): Promise<RadioPage> {
  const { data } = await api.get(API_ENDPOINTS.stations.list, { signal, ...(signal ? { timeout: 3500 } : {}), params: { page, limit: 64, country: isGlobalCountry(country) ? undefined : country, sort: 'votes', order: 'desc', excludeBroken: true } });
  const stations: Station[] = Array.isArray(data) ? data : data.stations || data.data || [];
  return { stations: uniqueRadios(stations), totalCount: Number(data.totalCount ?? data.total ?? data.pagination?.totalCount ?? data.pagination?.total ?? stations.length) };
}
// Sharing a short-lived catalog request avoids fetching the same first page for every pull.
let worldCatalog: { data: RadioPage; at: number } | null = null;
let worldCatalogRequest: Promise<RadioPage> | null = null;
async function getWorldCatalog(): Promise<RadioPage> {
  if (worldCatalog && Date.now() - worldCatalog.at < 180000) return worldCatalog.data;
  if (!worldCatalogRequest) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 3500);
    worldCatalogRequest = getCarRadioPage(1, undefined, timeout.signal).then(data => {
      worldCatalog = { data, at: Date.now() }; return data;
    }).finally(() => { clearTimeout(timer); worldCatalogRequest = null; });
  }
  return worldCatalogRequest;
}
/** Artwork-only transition reserve. It never selects a playable result or probes streams. */
export async function getWorldTransitionRadios():Promise<Station[]>{
 const {stations}=await getWorldCatalog();
 const valid=stations.filter(station=>eligibleWorldRadio(station)&&worldCountryKeys(station).length);
 const countries=new Set<string>(),diverse:Station[]=[];
 for(const station of valid){const key=worldCountryKeys(station)[0];if(!countries.has(key)){countries.add(key);diverse.push(station);}}
 return uniqueRadios([...diverse,...valid]).slice(0,24);
}
const recentWorldPages: number[] = [];
/** Random global discovery, published only after its artwork and stream pass live checks. */
export async function drawWorldRadio(excluded: Set<string>, random = Math.random, signal?: AbortSignal, reservedCountries: ReadonlySet<string> = new Set()): Promise<Station | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const deadline = setTimeout(abort, 20000);
  const attempted = new Set(excluded);
  try {
    const [first] = await Promise.all([getWorldCatalog(), loadWorldRadioHistory()]);
    if (controller.signal.aborted) return null;
    if (!first.totalCount) return null;
    const countries = new Set([...worldCountryRotation.blocked(), ...reservedCountries]);
    const pageCount = Math.max(1, Math.ceil(first.totalCount / 64));
    const triedPages = new Set<number>();
    for (let attempt = 0; attempt < 4 && !controller.signal.aborted; attempt++) {
      const blocked = new Set([...recentWorldPages.slice(-Math.min(64, pageCount - 1)), ...triedPages]);
      let page = Math.min(pageCount, Math.floor(random() * pageCount) + 1);
      for (let scan = 0; scan < pageCount && blocked.has(page); scan++) page = page % pageCount + 1;
      triedPages.add(page);
      recentWorldPages.push(page);
      if (recentWorldPages.length > 64) recentWorldPages.shift();
      let data = first;
      if (page !== 1) {
        try { data = await getCarRadioPage(page, undefined, controller.signal); }
        catch { if (controller.signal.aborted) return null; }
      }
      // Give unseen global pages both verification slots. Popular radios are a
      // last-attempt fallback, rather than winning half of every prepared draw.
      const sampled = shuffledRadios(data.stations, random);
      const reliable = attempt === 3 ? shuffledRadios(first.stations, random) : [];
      const candidateKeys = new Set<string>();
      const candidates = uniqueRadios([...sampled, ...reliable]).filter(station => {
        const country = worldCountryKeys(station);
        if (!country.length || country.some(key => countries.has(key)) || attempted.has(station._id) || worldRadioHistory.has(station) || !eligibleWorldRadio(station)) return false;
        const keys = worldRadioKeys(station);
        if (keys.some(key => candidateKeys.has(key))) return false;
        keys.forEach(key => candidateKeys.add(key));
        return true;
      }).slice(0, 8);
      for (const candidate of candidates) attempted.add(candidate._id);
      const station = await firstVerifiedRadio(candidates, controller.signal);
      if (station) return station;
    }
    return null;
  } finally { clearTimeout(deadline); signal?.removeEventListener('abort', abort); controller.abort(); }
}
