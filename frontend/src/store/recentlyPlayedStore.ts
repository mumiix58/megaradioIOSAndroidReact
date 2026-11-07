import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';
import { captureAccount, isAccountCurrent, accountKey } from './accountScope';
import api from '../services/api';
import type { Station } from '../types';
interface RecentlyPlayedState {
  stations: Station[]; loaded: boolean; isLoading: boolean;
  addStation: (station: Station) => void;
  loadFromStorage: () => Promise<void>; loadFromAPI: () => Promise<void>; syncToAPI: (id: string) => Promise<void>;
}
let revision = 0;
export const useRecentlyPlayedStore = create<RecentlyPlayedState>((set, get) => ({
  stations: [], loaded: false, isLoading: false,
  addStation: station => {
    const scope = captureAccount(); revision += 1;
    const stations = [station, ...get().stations.filter(s => s._id !== station._id)].slice(0, 12);
    set({ stations });
    void AsyncStorage.setItem(accountKey('recent', scope), JSON.stringify(stations)).catch(() => {});
    if (scope.token) void get().syncToAPI(station._id);
  },
  loadFromStorage: async () => {
    const scope = captureAccount(); const started = revision;
    try {
      const raw = await AsyncStorage.getItem(accountKey('recent', scope));
      if (isAccountCurrent(scope) && revision === started) set({ stations: raw ? JSON.parse(raw) : [], loaded: true, isLoading: false });
    } catch { if (isAccountCurrent(scope)) set({ loaded: true, isLoading: false }); }
  },
  loadFromAPI: async () => {
    const scope = captureAccount(); const started = revision;
    if (!scope.token) return get().loadFromStorage();
    set({ isLoading: true });
    try {
      const response = await api.get('/api/recently-played');
      if (!isAccountCurrent(scope)) return;
      if (revision !== started) { set({ isLoading: false }); return; }
      const data = Array.isArray(response.data) ? response.data : response.data.stations || [];
      const seen = new Set<string>();
      const stations = data.filter((s: Station) => !seen.has(s._id) && seen.add(s._id)).slice(0, 12);
      set({ stations, loaded: true, isLoading: false });
      await AsyncStorage.setItem(accountKey('recent', scope), JSON.stringify(stations));
    } catch {
      if (!isAccountCurrent(scope)) return;
      if (revision === started) await get().loadFromStorage();
      else set({ loaded: true, isLoading: false });
    }
  },
  syncToAPI: async stationId => {
    if (!captureAccount().token) return;
    try { await api.post('/api/recently-played', { stationId }); } catch { /* Local history remains account-scoped while offline. */ }
  },
}));
useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token || state.user?._id !== previous.user?._id) {
    revision += 1;
    useRecentlyPlayedStore.setState({ stations: [], loaded: false, isLoading: false });
    void useRecentlyPlayedStore.getState().loadFromAPI();
  }
});
export default useRecentlyPlayedStore;
