// Autoplay runs once after a signed-in session and its required data are ready.
import { useEffect, useRef, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { usePlayerStore } from '../store/playerStore';
import { AudioContext } from '../providers/AudioProvider';
import { stationService } from '../services/stationService';
import type { Station } from '../types';
import { PLAY_AT_LOGIN_KEY, LAST_PLAYED_STATION_KEY, normalizePlayAtLogin } from '../utils/playAtLogin';

const playable = (station: Station | null | undefined): station is Station =>
  !!station?._id && /^https?:\/\//i.test(station.urlResolved || station.url_resolved || station.url || '');

export const PlayAtLoginHandler: React.FC = () => {
  const hasExecuted = useRef(false);
  const { isAuthenticated, isAuthLoaded, user } = useAuthStore();
  const { favorites, isLoaded: favoritesLoaded, isLoading: favoritesLoading } = useFavoritesStore();
  const owner = user?._id || user?.id;
  // The error boundary can deliberately provide no audio context.
  const audio = useContext(AudioContext);
  const playStation = audio?.playStation;

  useEffect(() => {
    // Design preview reloads are not app launches; only explicit play gestures start audio.
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') return;
    if (!playStation || !isAuthLoaded || !isAuthenticated || hasExecuted.current) return;
    let disposed = false;
    const stillCurrent = () => {
      const auth = useAuthStore.getState();
      return !disposed && !hasExecuted.current && auth.isAuthenticated && (auth.user?._id || auth.user?.id) === owner;
    };
    const execute = async () => {
      try {
        if (!stillCurrent()) return;
        const setting = normalizePlayAtLogin(await AsyncStorage.getItem(PLAY_AT_LOGIN_KEY));
        if (!stillCurrent()) return;
        if (setting === 'off') { hasExecuted.current = true; return; }
        if (setting === 'favorite' && (!favoritesLoaded || favoritesLoading)) return;
        // A manual play, shortcut or deep link always takes priority over startup autoplay.
        if (usePlayerStore.getState().currentStation) { hasExecuted.current = true; return; }
        let station: Station | null = null;
        if (setting === 'last_played') {
          const raw = await AsyncStorage.getItem(LAST_PLAYED_STATION_KEY);
          if (raw) {
            try { const saved = JSON.parse(raw); if (playable(saved)) station = saved; }
            catch { /* An invalid saved entry must not prevent app startup. */ }
          }
        } else if (setting === 'favorite') {
          station = useFavoritesStore.getState().getSortedFavorites().find(playable) || null;
        } else {
          // Select a random position across the entire catalog, rather than its first 50 rows.
          const first = await stationService.getStations({ limit: 1, page: 1 });
          if (!stillCurrent()) return;
          const total = Number(first.totalCount);
          if (Number.isSafeInteger(total) && total > 0) {
            const page = 1 + Math.floor(Math.random() * total);
            const result = page === 1 ? first : await stationService.getStations({ limit: 1, page });
            station = result.stations.find(playable) || null;
          }
        }
        if (!stillCurrent()) return;
        // A setting may have changed while the catalog request was in flight.
        const latest = normalizePlayAtLogin(await AsyncStorage.getItem(PLAY_AT_LOGIN_KEY));
        if (!stillCurrent()) return;
        hasExecuted.current = true;
        if (latest !== setting || usePlayerStore.getState().currentStation || !station) return;
        await playStation(station);
      } catch (error) {
        if (!disposed) { hasExecuted.current = true; console.log('[PlayAtLogin] Autoplay unavailable:', error); }
      }
    };
    const timer = setTimeout(() => { void execute(); }, 500);
    return () => { disposed = true; clearTimeout(timer); };
  }, [isAuthenticated, isAuthLoaded, owner, favorites, favoritesLoaded, favoritesLoading, playStation]);
  return null;
};
export default PlayAtLoginHandler;
