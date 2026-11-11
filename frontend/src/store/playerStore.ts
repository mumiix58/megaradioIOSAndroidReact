import { create } from 'zustand';
import { currentTrackText, normalizeNowPlaying, type MetadataStatus } from '../utils/nowPlaying';
import type { Station, NowPlayingMetadata } from '../types';
import { useRecentlyPlayedStore } from './recentlyPlayedStore';
import { flowaliveService } from '../services/flowaliveService';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export type PlaybackOrigin = { kind: 'favorites' | 'browse'; country?: string; stationId: string };

interface PlayerState {
  playbackOrigin: PlaybackOrigin | null;
  setPlaybackOrigin: (origin: PlaybackOrigin) => void;
  currentStation: Station | null;
  playbackState: PlaybackState;
  streamUrl: string | null;
  nowPlaying: NowPlayingMetadata | null;
  metadataStatus: MetadataStatus;
  setMetadataStatus: (status:MetadataStatus)=>void;
  volume: number;
  isMiniPlayerVisible: boolean;
  errorMessage: string | null;
  // Sleep timer
  sleepTimerActive: boolean;
  sleepTimerRemaining: number;
  sleepTimerEndsAt: number | null;
  sleepTimerInterval: ReturnType<typeof setInterval> | null;
  // Actions
  setCurrentStation: (station: Station | null) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setStreamUrl: (url: string | null) => void;
  setNowPlaying: (metadata: NowPlayingMetadata | null) => void;
  setVolume: (volume: number) => void;
  setMiniPlayerVisible: (visible: boolean) => void;
  hideMiniPlayer: () => void;
  setError: (message: string | null) => void;
  startSleepTimer: (minutes: number, onExpire: () => void) => void;
  cancelSleepTimer: () => void;
  reset: () => void;
}

const initialState = {
  playbackOrigin: null as PlaybackOrigin | null,
  currentStation: null,
  playbackState: 'idle' as PlaybackState,
  streamUrl: null,
  nowPlaying: null,
  metadataStatus: 'idle' as MetadataStatus,
  volume: 1,
  isMiniPlayerVisible: false,
  errorMessage: null,
  sleepTimerActive: false,
  sleepTimerRemaining: 0,
  sleepTimerEndsAt: null,
  sleepTimerInterval: null,
};

let recordedHistoryStationId: string | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...initialState,
  setPlaybackOrigin: playbackOrigin => set({ playbackOrigin }),

  setCurrentStation: (station) => {
    if (station?._id !== get().currentStation?._id) recordedHistoryStationId = null;
    set({
      currentStation: station,
      ...(station && station._id !== get().currentStation?._id ? { playbackState: 'loading' as PlaybackState, nowPlaying: null, metadataStatus: 'loading' as MetadataStatus } : {}),
      isMiniPlayerVisible: station !== null,
      errorMessage: null,
    });
    
    // Selection analytics; history is recorded only after confirmed playback.
    if (station) {
      // Track station play in analytics
      flowaliveService.trackStationPlayed(station._id, station.name, station.tags?.split(',')[0]);
    }
  },

  setPlaybackState: (state) => {
    const prevState = get().playbackState;
    const station = get().currentStation;
    
    set({ playbackState: state });
    if (state === 'idle') recordedHistoryStationId = null;
    if (state === 'playing' && station && recordedHistoryStationId !== station._id) {
      recordedHistoryStationId = station._id;
      useRecentlyPlayedStore.getState().addStation(station);
    }
    
    // Track pause event
    if (state === 'paused' && prevState === 'playing' && station) {
      flowaliveService.trackStationPaused(station._id, station.name);
    }
  },

  setStreamUrl: (url) =>
    set({ streamUrl: url }),

  setMetadataStatus: metadataStatus => set({metadataStatus}),
  setNowPlaying: (metadata) => set(state => {
    const nowPlaying=metadata?normalizeNowPlaying(metadata,state.currentStation?.name||metadata.station||''):null;
    return {nowPlaying,metadataStatus:currentTrackText(nowPlaying,state.currentStation?.name||'',state.currentStation?.country||'')?'available':'unavailable'};
  }),

  setVolume: (volume) =>
    set({ volume: Math.max(0, Math.min(1, volume)) }),

  setMiniPlayerVisible: (visible) =>
    set({ isMiniPlayerVisible: visible }),

  hideMiniPlayer: () =>
    set({ 
      isMiniPlayerVisible: false,
      currentStation: null,
      playbackState: 'idle',
      streamUrl: null,
      nowPlaying: null,
    }),

  setError: (message) => {
    const station = get().currentStation;
    set({ errorMessage: message, playbackState: message ? 'error' : get().playbackState === 'error' ? 'idle' : get().playbackState });
    // Track playback error in analytics
    if (message && station) {
      flowaliveService.trackPlaybackError(station._id, message);
    }
  },

  startSleepTimer: (minutes, onExpire) => {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return;
    // Clear existing timer
    const existing = get().sleepTimerInterval;
    if (existing) clearInterval(existing);

    const totalSeconds = Math.ceil(minutes * 60);
    const endsAt = Date.now() + totalSeconds * 1000;
    set({ sleepTimerActive: true, sleepTimerRemaining: totalSeconds, sleepTimerEndsAt: endsAt });

    const interval = setInterval(() => {
      if (get().sleepTimerInterval !== interval || get().sleepTimerEndsAt !== endsAt) { clearInterval(interval); return; }
      // A delayed/background JS tick must not extend the selected duration.
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (remaining === 0) {
        clearInterval(interval);
        set({ sleepTimerActive: false, sleepTimerRemaining: 0, sleepTimerEndsAt: null, sleepTimerInterval: null });
        onExpire();
      } else {
        set({ sleepTimerRemaining: remaining });
      }
    }, 1000);

    set({ sleepTimerInterval: interval });
  },

  cancelSleepTimer: () => {
    const interval = get().sleepTimerInterval;
    if (interval) clearInterval(interval);
    set({ sleepTimerActive: false, sleepTimerRemaining: 0, sleepTimerEndsAt: null, sleepTimerInterval: null });
  },

  reset: () => {
    const interval = get().sleepTimerInterval;
    if (interval) clearInterval(interval);
    set(initialState);
  },
}));

export default usePlayerStore;
