// useAudioPlayer - Backward compatible hook
// All audio functionality is centralized in AudioProvider
// This hook provides access to the shared audio context

import { useCallback, useContext } from 'react';
import { AudioContext, AudioContextType } from '../providers/AudioProvider';
import { usePlayerStore } from '../store/playerStore';
import type { Station } from '../types';
import type { PlaybackOrigin } from '../store/playerStore';
import { useNativeCast } from '../contexts/NativeCastContext';
import { useLocationStore } from '../store/locationStore';
import { isGlobalCountry } from '../utils/countryScope';

// Hook to access audio context (throws if not in provider)
export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

// Backward compatible hook - returns same interface as before
export const useAudioPlayer = () => {
  const context = useContext(AudioContext);
  const station = usePlayerStore(state => state.currentStation);
  const playbackState = usePlayerStore(state => state.playbackState);
  const streamUrl = usePlayerStore(state => state.streamUrl);
  const reset = usePlayerStore(state => state.reset);
  const cast = useNativeCast();
  const remote = !!station && cast.remoteStationId === station._id;
  const playStation = useCallback(async (station: Station, source?: Omit<PlaybackOrigin, 'stationId'>) => {
    if (!context) return;
    const current = usePlayerStore.getState();
    if (source || station._id !== current.currentStation?._id) {
      const location = useLocationStore.getState();
      const country = location.countryEnglish || location.country;
      current.setPlaybackOrigin({ ...(source || { kind: 'browse', country: isGlobalCountry(country) ? undefined : country || undefined }), stationId: station._id });
    }
    if (cast.remoteStationId === station._id && current.currentStation?._id === station._id) return cast.togglePlayPause();
    return context.playStation(station);
  }, [context?.playStation, cast.remoteStationId, cast.togglePlayPause]);
  
  // If not in provider, return store values with dummy functions
  if (!context) {
    console.warn('[useAudioPlayer] Not in AudioProvider');
    return {
      currentStation: station,
      playbackState: playbackState,
      streamUrl: streamUrl,
      playStation: async (_station: Station) => {
        console.warn('[useAudioPlayer] AudioProvider not found');
      },
      stopPlayback: async () => {},
      pause: () => {},
      resume: () => {},
      togglePlayPause: () => {},
      setVolume: (_volume: number) => {},
      reset: reset,
      isReady: false,
    };
  }
  
  return {
    currentStation: context.currentStation,
    playbackState: context.playbackState,
    streamUrl: context.streamUrl,
    playStation,
    stopPlayback: async () => { if (remote && !(await cast.stop())) return; await context.stopPlayback(); },
    pause: remote ? cast.pause : context.pause,
    resume: remote ? cast.resume : context.resume,
    togglePlayPause: remote ? cast.togglePlayPause : context.togglePlayPause,
    setVolume: context.setVolume,
    reset: reset,
    isReady: true,
  };
};

export default useAudioPlayer;
