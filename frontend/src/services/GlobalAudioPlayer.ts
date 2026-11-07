// GlobalAudioPlayer - Singleton audio player for the entire app
// This ensures only ONE audio stream plays at a time across all screens

import { Audio, AudioPlayer } from 'expo-audio';
import { usePlayerStore } from '../store/playerStore';
import stationService from '../services/stationService';
import userService from '../services/userService';
import api from './api';
import type { Station } from '../types';

// ============================================
// SINGLETON AUDIO PLAYER MANAGER
// ============================================

class GlobalAudioPlayer {
  private static instance: GlobalAudioPlayer;
  private player: AudioPlayer | null = null;
  private currentStationId: string | null = null;
  private currentUrl: string | null = null;
  private playId: number = 0;
  private listeningStart: Date | null = null;
  private audioModeConfigured: boolean = false;
  private statusUnsubscribe: (() => void) | null = null;

  private constructor() {
    console.log('[GlobalAudioPlayer] Singleton created');
  }

  static getInstance(): GlobalAudioPlayer {
    if (!GlobalAudioPlayer.instance) {
      GlobalAudioPlayer.instance = new GlobalAudioPlayer();
    }
    return GlobalAudioPlayer.instance;
  }

  // Initialize audio mode (call once at app start)
  async initializeAudioMode(): Promise<void> {
    if (this.audioModeConfigured) return;
    
    try {
      await Audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      this.audioModeConfigured = true;
      console.log('[GlobalAudioPlayer] Audio mode configured');
    } catch (error) {
      console.error('[GlobalAudioPlayer] Failed to set audio mode:', error);
    }
  }

  // Create player if not exists
  private async ensurePlayer(): Promise<AudioPlayer> {
    if (!this.player) {
      console.log('[GlobalAudioPlayer] Creating new player instance');
      this.player = new Audio.Sound() as any; // Will be replaced with actual player
      // Actually, expo-audio uses a different API. Let's use the correct one.
    }
    return this.player!;
  }

  // Get current state
  getCurrentStationId(): string | null {
    return this.currentStationId;
  }

  isPlaying(): boolean {
    return this.player?.playing === true;
  }

  // STOP current playback
  async stop(): Promise<void> {
    console.log('[GlobalAudioPlayer] ========== STOP ==========');
    
    // Record listening time
    if (this.listeningStart && this.currentStationId) {
      const duration = Math.floor(
        (new Date().getTime() - this.listeningStart.getTime()) / 1000
      );
      if (duration > 5) {
        userService.recordListening(
          this.currentStationId,
          duration,
          this.listeningStart.toISOString()
        ).catch(() => {});
      }
    }

    // Invalidate any pending operations
    this.playId++;
    this.currentStationId = null;
    this.currentUrl = null;
    this.listeningStart = null;

    // Stop the player
    if (this.player) {
      try {
        this.player.pause();
      } catch (e) {
        console.log('[GlobalAudioPlayer] Pause error (ignored):', e);
      }
    }

    // Update store
    const store = usePlayerStore.getState();
    store.setPlaybackState('idle');
    store.setMiniPlayerVisible(false);
  }

  // PLAY a station
  async play(station: Station, player: AudioPlayer): Promise<void> {
    console.log('[GlobalAudioPlayer] ========== PLAY ==========');
    console.log('[GlobalAudioPlayer] Station:', station.name);

    // Store reference to the shared player
    this.player = player;

    // Same station? Toggle play/pause
    if (this.currentStationId === station._id) {
      console.log('[GlobalAudioPlayer] Same station - toggling');
      if (this.player.playing) {
        this.player.pause();
        usePlayerStore.getState().setPlaybackState('paused');
      } else {
        this.player.play();
        usePlayerStore.getState().setPlaybackState('playing');
      }
      return;
    }

    const store = usePlayerStore.getState();
    const myPlayId = ++this.playId;

    try {
      // STEP 1: Stop current playback IMMEDIATELY
      console.log('[GlobalAudioPlayer] Step 1: Stopping previous...');
      if (this.player) {
        try {
          this.player.pause();
        } catch (e) {
          // Ignore
        }
      }

      // Record listening for previous station
      if (this.listeningStart && this.currentStationId) {
        const duration = Math.floor(
          (new Date().getTime() - this.listeningStart.getTime()) / 1000
        );
        if (duration > 5) {
          userService.recordListening(
            this.currentStationId,
            duration,
            this.listeningStart.toISOString()
          ).catch(() => {});
        }
      }

      // STEP 2: Update UI immediately
      store.setPlaybackState('loading');
      store.setError(null);
      store.setCurrentStation(station);
      store.setMiniPlayerVisible(true);
      this.currentStationId = station._id;

      // Record click (non-blocking)
      stationService.recordClick(station._id).catch(() => {});

      // STEP 3: Resolve stream URL
      console.log('[GlobalAudioPlayer] Step 2: Resolving URL...');
      const url = await this.resolveStreamUrl(station);
      if (!url) throw new Error('Could not resolve stream URL');

      // Check if still current request
      if (this.playId !== myPlayId) {
        console.log('[GlobalAudioPlayer] Request stale, aborting');
        return;
      }

      console.log('[GlobalAudioPlayer] URL:', url.substring(0, 60));
      store.setStreamUrl(url);
      this.currentUrl = url;

      // STEP 4: Replace source and play
      console.log('[GlobalAudioPlayer] Step 3: Playing...');
      this.player.replace({ uri: url });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (this.playId !== myPlayId) {
        console.log('[GlobalAudioPlayer] Request stale after replace');
        return;
      }

      this.player.play();
      this.listeningStart = new Date();
      store.setPlaybackState('playing');

      console.log('[GlobalAudioPlayer] ========== NOW PLAYING ==========');

      // Background tasks
      userService.recordRecentlyPlayed(station._id).catch(() => {});
      this.fetchNowPlaying(station._id);

    } catch (error) {
      console.error('[GlobalAudioPlayer] Play failed:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to play');
      store.setPlaybackState('error');
    }
  }

  // Pause
  pause(): void {
    if (this.player) {
      this.player.pause();
      usePlayerStore.getState().setPlaybackState('paused');
    }
  }

  // Resume
  resume(): void {
    if (this.player) {
      this.player.play();
      usePlayerStore.getState().setPlaybackState('playing');
    }
  }

  // Toggle play/pause
  togglePlayPause(): void {
    if (!this.player) return;
    
    if (this.player.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  // Resolve stream URL
  private async resolveStreamUrl(station: Station): Promise<string | null> {
    try {
      const streamData = await stationService.resolveStream(station.url);

      if (streamData.candidates && streamData.candidates.length > 0) {
        let resolvedUrl = streamData.candidates[0];
        
        const isKnownWorkingHttps = resolvedUrl.includes('stream.laut.fm') || 
                                     resolvedUrl.includes('radiohost.de') ||
                                     resolvedUrl.includes('streamtheworld.com');
        
        if (resolvedUrl.startsWith('http://') || !isKnownWorkingHttps) {
          resolvedUrl = stationService.getProxyUrl(resolvedUrl);
        }

        return resolvedUrl;
      }

      let fallbackUrl = station.url_resolved || station.url;
      return stationService.getProxyUrl(fallbackUrl);
    } catch (error) {
      let fallbackUrl = station.url_resolved || station.url;
      return stationService.getProxyUrl(fallbackUrl);
    }
  }

  // Fetch now playing
  private async fetchNowPlaying(stationId: string): Promise<void> {
    try {
      // Use the correct endpoint: /api/now-playing/{id}
      const response = await api.get(`/api/now-playing/${encodeURIComponent(stationId)}`);
      if (this.currentStationId !== stationId) return;
      if (response.status === 200) {
        const metadata = response.data;
        console.log('[GlobalAudioPlayer] Now playing metadata:', metadata);
        if (metadata && (metadata.title || metadata.artist)) {
          usePlayerStore.getState().setNowPlaying(metadata);
          return;
        }
      } else {
        console.log('[GlobalAudioPlayer] Now playing response not ok:', response.status);
      }
    } catch (error) {
      console.error('[GlobalAudioPlayer] fetchNowPlaying error:', error);
    }
    
    // Fallback to stationService
    try {
      const metadata = await stationService.getNowPlaying(stationId);
      if (this.currentStationId !== stationId) return;
      if (metadata && (metadata.title || metadata.artist)) {
        console.log('[GlobalAudioPlayer] Now playing from stationService:', metadata);
        usePlayerStore.getState().setNowPlaying(metadata);
      }
    } catch (fallbackError) {
      console.error('[GlobalAudioPlayer] fallback getNowPlaying error:', fallbackError);
    }
  }
}

// Export singleton instance
export const globalAudioPlayer = GlobalAudioPlayer.getInstance();
export default globalAudioPlayer;
