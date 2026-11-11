import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';
import api from '../services/api';
import type { Station } from '../types';
import { mergeRecentlyPlayed } from '../utils/recentlyPlayed';

const STORAGE_KEY = 'megaradio_recently_played';
const ownerNow = () => {
  const state = useAuthStore.getState();
  return state.isAuthenticated && state.user?._id ? String(state.user._id) : 'guest';
};
// Legacy device history has no account identity; keep it guest-only.
const storageKey = (owner: string) => owner === 'guest' ? STORAGE_KEY : `${STORAGE_KEY}:${owner}`;
let write = Promise.resolve();
function persist(owner: string, stations: Station[]) {
  const value = JSON.stringify(stations);
  write = write.then(() => AsyncStorage.setItem(storageKey(owner),value)).catch(() => {});
}
const localLoads = new Map<string,Promise<void>>();
interface RecentlyPlayedState {
  owner: string;
  stations: Station[];
  loaded: boolean;
  isLoading: boolean;
  addStation: (station: Station) => void;
  loadFromStorage: () => Promise<void>;
  loadFromAPI: () => Promise<void>;
  syncToAPI: (stationId: string) => Promise<void>;
}
export const useRecentlyPlayedStore = create<RecentlyPlayedState>((set,get) => {
  const ensureOwner = () => {
    const owner = ownerNow();
    if (get().owner !== owner) set({ owner, stations: [], loaded: false, isLoading: false });
    return owner;
  };
  return {
    owner: ownerNow(), stations: [], loaded: false, isLoading: false,
    addStation(station) {
      const owner = ensureOwner();
      if (!station?._id) return;
      const stations = mergeRecentlyPlayed([{...station,playedAt:new Date().toISOString()}],get().stations);
      set({ stations });
      if (get().loaded) persist(owner,stations);
      else void get().loadFromStorage().then(() => persist(owner,get().owner === owner ? get().stations : stations));
      if (owner !== 'guest') void get().syncToAPI(station._id);
    },
    loadFromStorage() {
      const owner = ensureOwner();
      if (get().loaded) return Promise.resolve();
      const pending = localLoads.get(owner);
      if (pending) return pending;
      const load = (async () => {
        try {
          const raw = await AsyncStorage.getItem(storageKey(owner));
          const stored = raw ? JSON.parse(raw) : [];
          if (get().owner === owner) set({ stations:mergeRecentlyPlayed(get().stations,stored), loaded:true });
        } catch {
          if (get().owner === owner) set({ loaded:true });
        }
      })().finally(() => { localLoads.delete(owner); });
      localLoads.set(owner,load);
      return load;
    },
    async loadFromAPI() {
      const owner = ensureOwner();
      await get().loadFromStorage();
      if (owner === 'guest' || get().owner !== owner) return;
      set({ isLoading:true });
      try {
        const response = await api.get('/api/recently-played');
        if (ownerNow() !== owner || get().owner !== owner) return;
        const stations = mergeRecentlyPlayed(get().stations,Array.isArray(response.data) ? response.data : response.data?.stations);
        set({ stations,loaded:true,isLoading:false });
        persist(owner,stations);
      } catch {
        if (get().owner === owner) set({ isLoading:false });
      }
    },
    async syncToAPI(stationId) {
      if (ownerNow() === 'guest') return;
      try { await api.post('/api/recently-played',{stationId}); } catch { /* Local history remains available offline. */ }
    },
  };
});
useAuthStore.subscribe((state,previous) => {
  if (state.isAuthenticated !== previous.isAuthenticated || state.user?._id !== previous.user?._id) {
    useRecentlyPlayedStore.setState({ owner:ownerNow(), stations:[],loaded:false,isLoading:false });
    void useRecentlyPlayedStore.getState().loadFromStorage();
  }
});
export default useRecentlyPlayedStore;
