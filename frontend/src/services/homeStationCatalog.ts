import api from './api';
import { diskCache } from './diskCacheService';
import { getStationLogoUrl } from '../utils/stationLogoHelper';
import { buildGlobalPopularPool, popularCountryKey } from '../utils/popularStationRotation';
import { isGlobalCountry } from '../utils/countryScope';
import type { Station } from '../types';

export const HOME_CATALOG_FRESH_MS = 5 * 60 * 1000;
const RETAIN_MS = 24 * 60 * 60 * 1000;
type CachedCatalog = { stations: Station[]; savedAt: number };

// One bounded candidate pool; only the displayed cards load images. No image/stream probes.
export function selectHomeCatalog(stations: readonly Station[], country?: string, limit = 21, failedLogos: ReadonlySet<string> = new Set()): Station[] {
  const scope = !country || isGlobalCountry(country) ? '' : popularCountryKey({ country });
  const seen = new Set<string>();
  const eligible = stations.slice(0, 100).filter(station => {
    const key = popularCountryKey(station);
    const logo = getStationLogoUrl(station);
    // A URL left behind by a failed logo import is not evidence of a usable image.
    const failedImport = station.logoAssets?.status === 'failed' && !station.localImagePath;
    if (failedImport || !station._id || seen.has(station._id) || !key || (scope && key !== scope) || !logo || failedLogos.has(logo)) return false;
    seen.add(station._id);
    return true;
  });
  return scope ? eligible.slice(0, limit) : buildGlobalPopularPool(eligible, limit);
}

export function homeStationCatalogOptions(country?: string, enabled = true) {
  const scope = !country || isGlobalCountry(country) ? undefined : country;
  const key = `home-station-catalog:v1:${scope || 'global'}`;
  const cached = diskCache.get<CachedCatalog>(key, RETAIN_MS);
  return {
    queryKey: ['home-station-catalog', 'v1', scope || 'global'],
    enabled,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<CachedCatalog> => {
      const { data } = await api.get('/api/stations', { params: { country: scope, page: 1, limit: scope ? 60 : 100, sort: 'votes', order: 'desc', slim: 1 }, signal });
      if (!Array.isArray(data?.stations)) throw new Error('Invalid Home station catalog');
      const result = { stations: data.stations.slice(0, 100), savedAt: Date.now() };
      diskCache.set(key, result);
      return result;
    },
    initialData: cached || undefined,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: HOME_CATALOG_FRESH_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 1,
  };
}
