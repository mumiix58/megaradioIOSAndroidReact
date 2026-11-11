import React, { createContext, useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import type { Station } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import stationService from '../services/stationService';
import { resolveNowPlaying } from '../utils/nowPlaying';
import { LAST_PLAYED_STATION_KEY } from '../utils/playAtLogin';

export interface AudioContextType {
  playStation: (station: Station) => Promise<void>;
  stopPlayback: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  currentStation: Station | null;
  playbackState: string;
  streamUrl: string | null;
  isPlaying: boolean;
}
export const AudioContext = createContext<AudioContextType | null>(null);

// The native provider uses TrackPlayer. Browsers use their own media element.
export function AudioProvider({ children }: { children: React.ReactNode }) {
  const store = usePlayerStore();
  const media = useRef<HTMLAudioElement | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRequest = useRef(0);
  const clearLoadTimer = useCallback(() => { if (loadTimer.current) clearTimeout(loadTimer.current); loadTimer.current = null; }, []);
  const ensureMedia = useCallback(() => {
    if (!media.current) media.current = new Audio();
    {
      const audio = media.current;
      audio.preload = 'none';
      audio.volume = usePlayerStore.getState().volume;
      audio.onplaying = () => { if (!audio.getAttribute('src')) return; clearLoadTimer(); usePlayerStore.getState().setPlaybackState('playing'); };
      audio.onpause = () => { if (audio.getAttribute('src') && audio.paused && ['playing','buffering'].includes(usePlayerStore.getState().playbackState)) { clearLoadTimer(); usePlayerStore.getState().setPlaybackState('paused'); } };
      audio.onwaiting = () => { if (audio.getAttribute('src') && !audio.paused && !['error','paused','idle'].includes(usePlayerStore.getState().playbackState)) usePlayerStore.getState().setPlaybackState('buffering'); };
      audio.onerror = () => { if (!audio.getAttribute('src')) return; clearLoadTimer(); usePlayerStore.getState().setError('This station could not be played in this browser.'); };
      media.current = audio;
    }
    return media.current;
  }, [clearLoadTimer]);
  useEffect(() => () => {
    clearLoadTimer(); playRequest.current++;
    const audio = media.current;
    if (audio) { audio.onplaying = audio.onpause = audio.onwaiting = audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); }
  }, [clearLoadTimer]);
  useEffect(() => {
    const station = store.currentStation;
    if (!station || !store.isMiniPlayerVisible) return;
    let cancelled = false;
    let fetching = false;
    const refresh = async () => {
      const current = usePlayerStore.getState();
      if (fetching || current.currentStation?._id !== station._id || !['loading', 'playing', 'buffering'].includes(current.playbackState)) return;
      fetching = true;
      if(current.metadataStatus==='idle')current.setMetadataStatus('loading');
      try {
        const response = await stationService.getNowPlaying(station._id);
        if (cancelled || usePlayerStore.getState().currentStation?._id !== station._id) return;
        const state=usePlayerStore.getState();
        const next=resolveNowPlaying(response,state.nowPlaying,station.name,station.country);
        if(!next.retained){state.setNowPlaying(next.metadata);state.setMetadataStatus(next.status);}
      } catch {
        if(cancelled||usePlayerStore.getState().currentStation?._id!==station._id)return;
        const state=usePlayerStore.getState();
        const next=resolveNowPlaying(null,state.nowPlaying,station.name,station.country);
        if(!next.retained){state.setNowPlaying(next.metadata);state.setMetadataStatus(next.status);}
      } finally { fetching = false; }
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [store.currentStation?._id, store.isMiniPlayerVisible]);
  const resume = useCallback(async () => {
    const request = playRequest.current;
    try { await ensureMedia().play(); } catch (error) { if (request !== playRequest.current) return; clearLoadTimer(); usePlayerStore.getState().setError(error instanceof Error ? error.message : 'Playback failed'); }
  }, [ensureMedia, clearLoadTimer]);
  const pause = useCallback(() => { media.current?.pause(); }, []);
  const stopPlayback = useCallback(async () => {
    clearLoadTimer(); playRequest.current++;
    const audio = media.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    const state = usePlayerStore.getState(); state.setPlaybackState('idle'); state.setMiniPlayerVisible(false); state.setStreamUrl(null);
  }, [clearLoadTimer]);
  const playStation = useCallback(async (station: Station) => {
    const audio = ensureMedia();
    const state = usePlayerStore.getState();
    if (state.currentStation?._id === station._id && audio.getAttribute('src') && state.playbackState !== 'error') {
      if (audio.paused) await resume(); else pause(); return;
    }
    clearLoadTimer();
    const request = ++playRequest.current;
    const url = station.urlResolved || station.url_resolved || station.url;
    audio.pause();
    state.setCurrentStation(station); state.setNowPlaying(null); state.setMetadataStatus('loading'); state.setPlaybackState('loading');
    if (!url || !/^https?:\/\//i.test(url)) { state.setStreamUrl(null); state.setError('This station has no playable stream.'); return; }
    state.setStreamUrl(url);
    audio.src = url;
    loadTimer.current = setTimeout(() => {
      if (request !== playRequest.current || usePlayerStore.getState().currentStation?._id !== station._id) return;
      playRequest.current++; clearLoadTimer();
      audio.pause(); audio.removeAttribute('src'); audio.load();
      usePlayerStore.getState().setError('Station did not respond. Please try again or choose another station.');
    }, 15000);
    void AsyncStorage.setItem(LAST_PLAYED_STATION_KEY, JSON.stringify(station)).catch(() => {});
    await resume();
  }, [ensureMedia, pause, resume, clearLoadTimer]);
  const togglePlayPause = useCallback(async () => {
    const state = usePlayerStore.getState();
    if (['loading','buffering'].includes(state.playbackState)) { playRequest.current++; clearLoadTimer(); pause(); state.setPlaybackState('paused'); return; }
    if (state.playbackState === 'error' && state.currentStation) { await playStation(state.currentStation); return; }
    if (media.current?.getAttribute('src')) { if (media.current.paused) await resume(); else pause(); }
    else if (state.currentStation) await playStation(state.currentStation);
  }, [resume, pause, playStation, clearLoadTimer]);
  const setVolume = useCallback((volume: number) => {
    const value = Math.max(0, Math.min(1, volume)); usePlayerStore.getState().setVolume(value); if (media.current) media.current.volume = value;
  }, []);
  return <AudioContext.Provider value={{ currentStation: store.currentStation, playbackState: store.playbackState, streamUrl: store.streamUrl, isPlaying: store.playbackState === 'playing', playStation, pause, resume, stopPlayback, togglePlayPause, setVolume }}><audio ref={media} style={{ display: 'none' }} />{children}</AudioContext.Provider>;
}
export default AudioProvider;
