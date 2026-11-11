import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { homeStationCatalogOptions, selectHomeCatalog } from '../services/homeStationCatalog';
import { getStationLogoUrl } from '../utils/stationLogoHelper';
import type { Station } from '../types';

export function useHomeStationCatalog(country?: string, enabled = true, limit = 21) {
  const query = useQuery(homeStationCatalogOptions(country, enabled));
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(new Set());
  const rejectLogo = useCallback((station: Station) => {
    const logo = getStationLogoUrl(station);
    if (!logo) return;
    setFailedLogos(previous => previous.has(logo) ? previous : new Set([...previous, logo].slice(-128)));
  }, []);
  const stations = useMemo(() => enabled ? selectHomeCatalog(query.data?.stations || [], country, limit, failedLogos) : [], [enabled, query.data, country, limit, failedLogos]);
  return { ...query, stations, rejectLogo };
}
