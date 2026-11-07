import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { userService } from '../services/userService';
import { captureAccount, isAccountCurrent, accountKey, AccountScope } from './accountScope';
import type { Station } from '../types';

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'custom';
export type ViewMode = 'list' | 'grid';
type Change = { action: 'add' | 'remove'; stationId: string; operationId?: string };
interface FavoritesState {
  favorites: Station[]; customOrder: string[]; sortOption: SortOption; viewMode: ViewMode;
  isLoaded: boolean; isLoading: boolean; error: string | null;
  loadFavorites: () => Promise<void>; loadFromLocal: () => Promise<void>; loadLocalFavorites: () => Promise<void>;
  addFavorite: (station: Station) => Promise<void>; removeFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean; toggleFavorite: (station: Station) => Promise<void>;
  setSortOption: (option: SortOption) => void; setViewMode: (mode: ViewMode) => void;
  updateCustomOrder: (ids: string[]) => Promise<void>; getSortedFavorites: () => Station[];
  syncWithServer: () => Promise<void>;
}
let queueWrites: Promise<void> = Promise.resolve();
let localWrites: Promise<void> = Promise.resolve();
let revision = 0;
let operationSequence = 0;
const flushes = new Map<string, Promise<void>>();
function enqueue(scope: AccountScope, change: Change) {
  change = { ...change, operationId: `${Date.now()}:${++operationSequence}` };
  queueWrites = queueWrites.catch(() => {}).then(async () => {
    const key = accountKey('favorite_queue', scope);
    const queue: Change[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
    await AsyncStorage.setItem(key, JSON.stringify([...queue.filter(item => item.stationId !== change.stationId), change]));
  });
  return queueWrites;
}
function flush(scope: AccountScope): Promise<void> {
  const id = `${scope.ownerId}:${scope.version}`;
  const job = (flushes.get(id) || Promise.resolve()).catch(() => {}).then(() => flushQueue(scope));
  flushes.set(id, job);
  void job.finally(() => { if (flushes.get(id) === job) flushes.delete(id); }).catch(() => {});
  return job;
}
async function flushQueue(scope: AccountScope) {
  if (!scope.token) return;
  await queueWrites;
  const key = accountKey('favorite_queue', scope);
  const queue: Change[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
  for (const item of queue) {
    if (!isAccountCurrent(scope)) return;
    if (item.action === 'add') await userService.addFavorite(item.stationId);
    else await userService.removeFavorite(item.stationId);
    // Remove only the exact operation sent, preserving newer changes.
    queueWrites = queueWrites.catch(() => {}).then(async () => {
      const current: Change[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
      await AsyncStorage.setItem(key, JSON.stringify(current.filter(c => c.stationId !== item.stationId || c.action !== item.action || c.operationId !== item.operationId)));
    });
    await queueWrites;
  }
}
function save(scope: AccountScope, favorites: Station[], order?: string[]) {
  localWrites = localWrites.catch(() => {}).then(() => saveLocal(scope, favorites, order));
  return localWrites;
}
async function saveLocal(scope: AccountScope, favorites: Station[], order?: string[]) {
  await AsyncStorage.setItem(accountKey('favorites', scope), JSON.stringify(favorites));
  if (order) await AsyncStorage.setItem(accountKey('favorite_order', scope), JSON.stringify(order));
  if (Platform.OS === 'android' && isAccountCurrent(scope)) {
    await AsyncStorage.setItem('megaradio_android_auto_favorites', JSON.stringify(favorites.slice(0, 20).map(s => ({
      id: s._id, name: s.name, country: s.country || '', streamUrl: (s as any).urlResolved || s.url || '', favicon: s.favicon || s.logo || '',
    }))));
  }
}
async function local(scope: AccountScope) {
  let raw = await AsyncStorage.getItem(accountKey('favorites', scope));
  // Only the explicitly owned legacy backup can be migrated.
  if (!raw && scope.ownerId !== 'guest') raw = await AsyncStorage.getItem(`@megaradio_favorites_backup_${scope.ownerId}`);
  const order = await AsyncStorage.getItem(accountKey('favorite_order', scope));
  return { favorites: raw ? JSON.parse(raw) : [], customOrder: order ? JSON.parse(order) : [] };
}
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [], customOrder: [], sortOption: 'newest', viewMode: 'list', isLoaded: false, isLoading: false, error: null,
  loadFavorites: async () => {
    const scope = captureAccount();
    const started = revision;
    set({ isLoading: true, error: null });
    try {
      const cached = await local(scope);
      if (!isAccountCurrent(scope)) return;
      if (revision !== started) { set({ isLoaded: true, isLoading: false }); return; }
      if (!scope.token) { set({ ...cached, isLoaded: true, isLoading: false }); return; }
      try {
        await flush(scope);
        if (!isAccountCurrent(scope)) return;
        const favorites = await userService.getFavorites();
        if (!isAccountCurrent(scope)) return;
        if (revision !== started) { set({ isLoaded: true, isLoading: false }); return; }
        // A successful empty server list is authoritative; do not resurrect deleted favorites.
        set({ favorites, customOrder: cached.customOrder, isLoaded: true, isLoading: false });
        await save(scope, favorites);
      } catch {
        if (isAccountCurrent(scope)) set({ ...(revision === started ? cached : {}), isLoaded: true, isLoading: false, error: 'Could not refresh favorites' });
      }
    } catch {
      if (isAccountCurrent(scope)) set({ isLoading: false, isLoaded: true, error: 'Could not load favorites' });
    }
  },
  loadFromLocal: async () => {
    const scope = captureAccount();
    const started = revision;
    try {
      const cached = await local(scope);
      if (isAccountCurrent(scope)) set({ ...(revision === started ? cached : {}), isLoaded: true, isLoading: false });
    } catch { if (isAccountCurrent(scope)) set({ isLoaded: true, isLoading: false }); }
  },
  loadLocalFavorites: async () => get().loadFromLocal(),
  addFavorite: async station => {
    const scope = captureAccount();
    if (get().isFavorite(station._id)) return;
    const previous = { favorites: get().favorites, customOrder: get().customOrder };
    const changed = ++revision;
    const favorites = [{ ...station, addedAt: new Date().toISOString() }, ...get().favorites];
    const customOrder = [station._id, ...get().customOrder];
    set({ favorites, customOrder });
    try {
      await save(scope, favorites, customOrder);
      if (scope.token) await enqueue(scope, { action: 'add', stationId: station._id });
    } catch {
      if (isAccountCurrent(scope) && revision === changed) set({ ...previous, error: 'Could not save favorite' });
      return;
    }
    if (scope.token && isAccountCurrent(scope)) {
      try { await flush(scope); } catch { /* Retry this owner's queue on next load. */ }
    }
  },
  removeFavorite: async stationId => {
    const scope = captureAccount();
    const previous = { favorites: get().favorites, customOrder: get().customOrder };
    const changed = ++revision;
    const favorites = get().favorites.filter(s => s._id !== stationId);
    const customOrder = get().customOrder.filter(id => id !== stationId);
    set({ favorites, customOrder });
    try {
      await save(scope, favorites, customOrder);
      if (scope.token) await enqueue(scope, { action: 'remove', stationId });
    } catch {
      if (isAccountCurrent(scope) && revision === changed) set({ ...previous, error: 'Could not save favorite' });
      return;
    }
    if (scope.token && isAccountCurrent(scope)) {
      try { await flush(scope); } catch { /* Retry this owner's queue on next load. */ }
    }
  },
  isFavorite: id => get().favorites.some(s => s._id === id),
  toggleFavorite: async station => get().isFavorite(station._id) ? get().removeFavorite(station._id) : get().addFavorite(station),
  setSortOption: sortOption => set({ sortOption }),
  setViewMode: viewMode => set({ viewMode }),
  updateCustomOrder: async customOrder => {
    const scope = captureAccount(); revision += 1; set({ customOrder });
    await AsyncStorage.setItem(accountKey('favorite_order', scope), JSON.stringify(customOrder));
  },
  getSortedFavorites: () => {
    const { favorites, customOrder, sortOption } = get();
    
    switch (sortOption) {
      case 'newest':
        // Sort by addedAt if available, otherwise keep original order (newest first)
        return [...favorites].sort((a, b) => {
          const dateA = (a as any).addedAt || (a as any).createdAt || '';
          const dateB = (b as any).addedAt || (b as any).createdAt || '';
          if (!dateA && !dateB) return 0; // Keep original order
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateB.localeCompare(dateA);
        });
      
      case 'oldest':
        return [...favorites].sort((a, b) => {
          const dateA = (a as any).addedAt || (a as any).createdAt || '';
          const dateB = (b as any).addedAt || (b as any).createdAt || '';
          if (!dateA && !dateB) return 0; // Keep original order
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.localeCompare(dateB);
        });
      
      case 'az':
        return [...favorites].sort((a, b) => 
          (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
        );
      
      case 'za':
        return [...favorites].sort((a, b) => 
          (b.name || '').toLowerCase().localeCompare((a.name || '').toLowerCase())
        );
      
      case 'custom':
        return [...favorites].sort((a, b) => {
          const indexA = customOrder.indexOf(a._id);
          const indexB = customOrder.indexOf(b._id);
          
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      
      default:
        return favorites;
    }
  },

  syncWithServer: async () => get().loadFavorites(),
}));
export default useFavoritesStore;
