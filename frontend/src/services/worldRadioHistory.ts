import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorldCountryRotation } from '../utils/worldCountryRotation';
import { WorldRadioHistory } from '../utils/worldRadioHistory';
import type { Station } from '../types';

const STORAGE_KEY = '@megaradio_world_radio_history_v1';
export const worldRadioHistory = new WorldRadioHistory();
export const worldCountryRotation = new WorldCountryRotation();
let loading: Promise<void> | null = null;
let writes = Promise.resolve();
export function loadWorldRadioHistory() {
  if (!loading) loading = Promise.all([
    AsyncStorage.getItem(STORAGE_KEY),
    AsyncStorage.getItem('megaradio_recently_played'),
  ]).then(([data, recent]) => {
    const current = worldRadioHistory.snapshot();
    try { if (data) worldRadioHistory.restore(JSON.parse(data)); } catch { /* Ignore invalid local history. */ }
    try {
      const stations: unknown = recent ? JSON.parse(recent) : [];
      if (Array.isArray(stations)) for (const station of [...stations].reverse()) {
        if (station && typeof station._id === 'string' && typeof station.name === 'string') worldRadioHistory.remember(station);
      }
    } catch { /* Recent listening is only a migration seed. */ }
    worldRadioHistory.restore([...worldRadioHistory.snapshot(), ...current]);
  }).catch(() => {});
  return loading;
}
export function rememberWorldRadio(station: Station) {
  worldRadioHistory.remember(station);
  // Load first and serialize writes so a slower old write cannot replace newer history.
  writes = writes.then(loadWorldRadioHistory).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(worldRadioHistory.snapshot()))).catch(() => {});
}
