import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureAccount, isAccountCurrent, accountKey } from './accountScope';
const MAX_HISTORY = 100;

export interface SongHistoryEntry {
  id: string;
  title: string;
  artist: string;
  stationName: string;
  stationId: string;
  stationFavicon?: string;
  timestamp: number;
}

interface SongHistoryState {
  entries: SongHistoryEntry[];
  loaded: boolean;

  // Actions
  addEntry: (entry: Omit<SongHistoryEntry, 'id' | 'timestamp'>) => void;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useSongHistoryStore = create<SongHistoryState>((set, get) => ({
  entries: [],
  loaded: false,

  addEntry: (entry) => {
    const scope = captureAccount();
    const current = get().entries;
    
    // Skip if same song+station as the most recent entry
    if (current.length > 0) {
      const last = current[0];
      if (last.title === entry.title && last.artist === entry.artist && last.stationId === entry.stationId) {
        return;
      }
    }

    // Skip entries with empty/generic titles
    if (!entry.title || entry.title === 'Live Stream' || entry.title === 'Unknown') {
      return;
    }

    const newEntry: SongHistoryEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    };

    const updated = [newEntry, ...current].slice(0, MAX_HISTORY);
    set({ entries: updated });

    // Persist
    AsyncStorage.setItem(accountKey('song_history', scope), JSON.stringify(updated)).catch(() => {});
  },

  loadHistory: async () => {
    if (get().loaded) return;
    const scope = captureAccount();
    try {
      const data = await AsyncStorage.getItem(accountKey('song_history', scope));
      if (!isAccountCurrent(scope)) return;
      if (data) {
        const parsed = JSON.parse(data) as SongHistoryEntry[];
        set({ entries: parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (error) {
      console.error('[SongHistoryStore] Error loading:', error);
      if (isAccountCurrent(scope)) set({ loaded: true });
    }
  },

  clearHistory: async () => {
    const scope = captureAccount();
    try {
      await AsyncStorage.removeItem(accountKey('song_history', scope));
      if (isAccountCurrent(scope)) set({ entries: [] });
    } catch (error) {
      console.error('[SongHistoryStore] Error clearing:', error);
    }
  },
}));
