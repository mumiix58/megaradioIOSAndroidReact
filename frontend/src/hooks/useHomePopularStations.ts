import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Station } from '../types';
import { hasPopularStationCountry, popularCountryKey } from '../utils/popularStationRotation';
import { isGlobalCountry } from '../utils/countryScope';
import { homePopularRotationReady, nextHomePopularBatch } from '../services/homePopularRotation';

// Select once per visit, including when the first response arrives after focus.
// Background refreshes and playback updates must not move cards under a finger.
export function useHomePopularStations(scope: string, stations: Station[] | undefined, ready: boolean) {
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    let active = true;
    void homePopularRotationReady.then(() => { if (active) setStorageReady(true); });
    return () => { active = false; };
  }, []);
  const latest = useRef({ stations, ready });
  latest.current = { stations, ready };
  const focused = useRef(false);
  const pending = useRef(false);
  const [batch, setBatch] = useState<{ scope: string; stations: Station[] }>({ scope: '', stations: [] });
  const select = useCallback(() => {
    const current = latest.current;
    if (!focused.current || !pending.current || !current.ready || !storageReady || !current.stations?.length) return;
    const pool = current.stations.filter(hasPopularStationCountry);
    const ids = nextHomePopularBatch(scope, pool.map(station => station._id), isGlobalCountry(scope) ? new Map(pool.map(station => [station._id, popularCountryKey(station)])) : undefined);
    const byId = new Map(pool.map(station => [station._id, station]));
    pending.current = false;
    setBatch({ scope, stations: ids.map(id => byId.get(id)!).filter(Boolean) });
  }, [scope, storageReady]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    pending.current = true;
    select();
    return () => { focused.current = false; };
  }, [select]));
  useEffect(() => { select(); }, [stations, ready, select]);
  const rotate = useCallback(() => { pending.current = true; select(); }, [select]);
  return { stations: ready && batch.scope === scope ? batch.stations : [], rotate };
}
