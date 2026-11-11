// AudioProvider - Single shared audio player using react-native-track-player
// This provides TRUE background audio and lock screen controls for iOS/Android

import React, { createContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';

import TrackPlayer, { 
  Capability,
  TrackType,
  State, 
  Event, 
  usePlaybackState, 
  useProgress,
  AppKilledPlaybackBehavior,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { Platform, InteractionManager, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/playerStore';
import { useFavoritesStore } from '../store/favoritesStore';
import stationService from '../services/stationService';
import userService from '../services/userService';
import { useRecentlyPlayedStore } from '../store/recentlyPlayedStore';
import statsService from '../services/statsService';
import { useAuthStore } from '../store/authStore';
import { syncCompanionCatalog } from '../services/companionCatalogService';
import { normalizeCompanionCountries } from '../utils/companionCountries';
import { nextRecommendation } from '../utils/recommendationQueue';
import watchService from '../services/watchService';
import wearOSService from '../services/wearOSService';
import { handleWearStationRequest } from '../services/wearStationRequest';
import { adMobService } from '../services/adMobService';
import { genreService } from '../services/genreService';
import api from '../services/api';
import { API_ENDPOINTS } from '../constants/api';
import type { Station } from '../types';

// Country name to flag emoji mapping
const COUNTRY_FLAGS: { [key: string]: string } = {
  'Turkey': '\u{1F1F9}\u{1F1F7}', 'Germany': '\u{1F1E9}\u{1F1EA}', 'France': '\u{1F1EB}\u{1F1F7}',
  'Italy': '\u{1F1EE}\u{1F1F9}', 'Spain': '\u{1F1EA}\u{1F1F8}', 'United Kingdom': '\u{1F1EC}\u{1F1E7}',
  'United States': '\u{1F1FA}\u{1F1F8}', 'Brazil': '\u{1F1E7}\u{1F1F7}', 'Japan': '\u{1F1EF}\u{1F1F5}',
  'Russia': '\u{1F1F7}\u{1F1FA}', 'Canada': '\u{1F1E8}\u{1F1E6}', 'Australia': '\u{1F1E6}\u{1F1FA}',
  'Netherlands': '\u{1F1F3}\u{1F1F1}', 'Belgium': '\u{1F1E7}\u{1F1EA}', 'Austria': '\u{1F1E6}\u{1F1F9}',
  'Switzerland': '\u{1F1E8}\u{1F1ED}', 'Poland': '\u{1F1F5}\u{1F1F1}', 'Sweden': '\u{1F1F8}\u{1F1EA}',
  'Norway': '\u{1F1F3}\u{1F1F4}', 'Denmark': '\u{1F1E9}\u{1F1F0}', 'Finland': '\u{1F1EB}\u{1F1EE}',
  'Portugal': '\u{1F1F5}\u{1F1F9}', 'Greece': '\u{1F1EC}\u{1F1F7}', 'Mexico': '\u{1F1F2}\u{1F1FD}',
  'Argentina': '\u{1F1E6}\u{1F1F7}', 'Colombia': '\u{1F1E8}\u{1F1F4}', 'India': '\u{1F1EE}\u{1F1F3}',
  'China': '\u{1F1E8}\u{1F1F3}', 'South Korea': '\u{1F1F0}\u{1F1F7}', 'Indonesia': '\u{1F1EE}\u{1F1E9}',
  'Thailand': '\u{1F1F9}\u{1F1ED}', 'Egypt': '\u{1F1EA}\u{1F1EC}', 'South Africa': '\u{1F1FF}\u{1F1E6}',
  'Nigeria': '\u{1F1F3}\u{1F1EC}', 'Romania': '\u{1F1F7}\u{1F1F4}', 'Czech Republic': '\u{1F1E8}\u{1F1FF}',
  'Hungary': '\u{1F1ED}\u{1F1FA}', 'Ireland': '\u{1F1EE}\u{1F1EA}', 'Israel': '\u{1F1EE}\u{1F1F1}',
  'Ukraine': '\u{1F1FA}\u{1F1E6}', 'Chile': '\u{1F1E8}\u{1F1F1}', 'Peru': '\u{1F1F5}\u{1F1EA}',
  'Philippines': '\u{1F1F5}\u{1F1ED}', 'Malaysia': '\u{1F1F2}\u{1F1FE}', 'Vietnam': '\u{1F1FB}\u{1F1F3}',
  'Pakistan': '\u{1F1F5}\u{1F1F0}', 'Bangladesh': '\u{1F1E7}\u{1F1E9}', 'Saudi Arabia': '\u{1F1F8}\u{1F1E6}',
  'United Arab Emirates': '\u{1F1E6}\u{1F1EA}', 'Azerbaijan': '\u{1F1E6}\u{1F1FF}',
};
const countryNameToFlag = (name: string): string => COUNTRY_FLAGS[name] || '\u{1F30D}';

// Storage keys - MUST match keys in service.js
const LAST_PLAYED_STATION_KEY = '@megaradio_last_played_station';
const CURRENT_STATION_KEY = '@megaradio_current_station';
const SIMILAR_STATIONS_KEY = '@megaradio_similar_stations';
const PLAYBACK_HISTORY_KEY = '@megaradio_playback_history';
const SIMILAR_INDEX_KEY = '@megaradio_similar_index';

// ============================================
// TYPES
// ============================================
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

// ============================================
// CONTEXT - exported for use in useAudioPlayer hook
// ============================================
export const AudioContext = createContext<AudioContextType | null>(null);

// ============================================
// GLOBAL STATE (module level - truly singleton)
// ============================================
let trackPlayerInitialized = false;
let globalPlayId = 0;
let currentPlayingStationId: string | null = null;
let listeningStartTime: Date | null = null;
let lastMetadataTitle: string | null = null; // Track last metadata to detect changes
// Startup pre-warm for the last played station (resolved playlist candidates)
let prewarmedResolve: { stationId: string; candidates: string[] } | null = null;

// ============================================
// TRACK PLAYER SETUP
// ============================================
let trackPlayerSetupPromise: Promise<boolean> | null = null;

// Once-lock: concurrent callers (deferred init + rapid playStation taps) share one setup
async function setupTrackPlayer(): Promise<boolean> {
  if (trackPlayerInitialized) {
    console.log('[AudioProvider] Track Player already initialized');
    return true;
  }
  if (trackPlayerSetupPromise) return trackPlayerSetupPromise;
  trackPlayerSetupPromise = doSetupTrackPlayer().finally(() => {
    trackPlayerSetupPromise = null;
  });
  return trackPlayerSetupPromise;
}

async function doSetupTrackPlayer(): Promise<boolean> {
  // Android forbids setup while a permission sheet/background launch owns the
  // foreground. Defer instead of logging an expected startup failure.
  if (Platform.OS === 'android' && AppState.currentState !== 'active') return false;
  try {
    console.log('[AudioProvider] Initializing Track Player...');
    
    // Check if already setup (in case of hot reload)
    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state !== State.None) {
        console.log('[AudioProvider] Track Player was already setup');
        trackPlayerInitialized = true;
        return true;
      }
    } catch {
      // Not setup yet, continue
    }

    await TrackPlayer.setupPlayer({
      // iOS specific options
      iosCategory: 'playback',
      iosCategoryMode: 'spokenAudio', // or 'default' for music
      iosCategoryOptions: [
        'allowAirPlay',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'duckOthers', // Lower other app's audio instead of stopping
        'interruptSpokenAudioAndMixWithOthers',
      ],
      // Wait for buffer before playing
      waitForBuffer: true,
    });

    // Configure player capabilities (what controls show on lock screen)
    await TrackPlayer.updateOptions({
      // Android specific
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      // What buttons to show in notification/control center
      // IMPORTANT: Only SkipToNext/Previous for radio app (previous/next station)
      // DO NOT include JumpForward/JumpBackward - they show 30s/15s skip icons instead
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      // What buttons are shown in compact notification (Android)
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      // Not used for live radio - but set to non-zero for iOS to enable skip
      progressUpdateEventInterval: 1,
    });

    trackPlayerInitialized = true;
    console.log('[AudioProvider] Track Player initialized successfully!');
    return true;
  } catch (error) {
    console.error('[AudioProvider] Failed to initialize Track Player:', error);
    return false;
  }
}

// ============================================
// PROVIDER COMPONENT
// ============================================
import { currentTrackText, normalizeNowPlaying, resolveNowPlaying, hasFreshIcyMetadata, isMetadataAdvertisement } from '../utils/nowPlaying';
import { buildStreamCandidates, isPlaylistStream, isHlsStream } from '../utils/streamSources';

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS === 'ios') watchService.initializeConnectivity();
      if (Platform.OS === 'android') wearOSService.initializeConnectivity();
      if (Platform.OS === 'ios' || Platform.OS === 'android') void syncCompanionCatalog(Platform.OS).catch(console.error);
    });
    return () => task.cancel();
  }, []);
  const statsOwner = useAuthStore(state => state.isAuthenticated ? state.user?._id || (state.user as any)?.id || null : null);
  const [isReady, setIsReady] = useState(false);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nowPlayingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const icyMetadataActiveRef = useRef<boolean>(false);
  const icyMetadataAtRef = useRef(0);
  const metadataPendingGenerationRef=useRef<number|null>(null);
  const metadataFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use Track Player hooks for state
  const playbackState = usePlaybackState();
  
  const {
    currentStation,
    nowPlaying: watchNowPlaying,
    playbackState: storePlaybackState,
    streamUrl,
    setCurrentStation,
    setPlaybackState,
    setStreamUrl,
    setNowPlaying,
    setError,
    setMiniPlayerVisible,
  } = usePlayerStore();

  useEffect(() => { lastMetadataTitle = null; }, [statsOwner]);
  // Cleanup captures the OUTGOING account, not the newly logged-in one.
  useEffect(() => {
    if (!currentStation || storePlaybackState !== 'playing') return;
    void statsService.startSession(currentStation._id, currentStation.name,
      currentStation.favicon, statsOwner).catch(console.error);
    void statsService.trackUniqueStation(currentStation._id, statsOwner).catch(console.error);
    return () => { void statsService.endSession(statsOwner).catch(console.error); };
  }, [statsOwner, currentStation?._id, storePlaybackState]);

  const streamLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparingQueueRef = useRef(false);
  const clearStreamLoadTimer = useCallback(() => {
    if (streamLoadTimerRef.current) clearTimeout(streamLoadTimerRef.current);
    streamLoadTimerRef.current = null;
  }, []);
  const startStreamLoadTimer = useCallback((requestId: number) => {
    clearStreamLoadTimer();
    streamLoadTimerRef.current = setTimeout(() => {
      if (requestId !== globalPlayId) return;
      globalPlayId++;
      currentPlayingStationId = null; // Same-station retry must create a fresh item.
      preparingQueueRef.current = false;
      setPlaybackState('error');
      setError('Station did not respond. Please try again or choose another station.');
      void TrackPlayer.reset().catch(() => {});
    }, 15000);
  }, [clearStreamLoadTimer, setError, setPlaybackState]);
  useEffect(() => clearStreamLoadTimer, [clearStreamLoadTimer]);

  // Listen to Track Player events
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError, Event.PlaybackMetadataReceived, Event.MetadataCommonReceived], async (event) => {
    // Reset/queue setup emits old-item events. They cannot finish or fail a new request.
    if (preparingQueueRef.current || !currentPlayingStationId) return;
    if (event.type === Event.PlaybackState) {
      console.log('[AudioProvider] Playback state changed:', event.state);
      
      switch (event.state) {
        case State.Playing:
          clearStreamLoadTimer();
          setPlaybackState('playing');
          // Reset retry count on successful playback
          failoverRetryCountRef.current = 0;
          break;
        case State.Paused:
          clearStreamLoadTimer();
          setPlaybackState('paused');
          break;
        case State.Stopped:
          setPlaybackState('idle');
          break;
        case State.Buffering:
        case State.Loading:
          if (!streamLoadTimerRef.current) startStreamLoadTimer(globalPlayId);
          setPlaybackState('buffering');
          break;
        case State.Error:
          setPlaybackState('error');
          break;
        default:
          break;
      }
    }
    
    if (event.type === Event.PlaybackError) {
      clearStreamLoadTimer();
      const requestId = globalPlayId;
      console.error('[AudioProvider] Playback error:', event);
      
      // STREAM FAILOVER: Try next candidate URL automatically
      const currentStation = usePlayerStore.getState().currentStation;
      if (currentStation && streamCandidatesRef.current.length > 0) {
        const candidates = streamCandidatesRef.current;
        const currentIndex = currentCandidateIndexRef.current;
        
        console.log('[AudioProvider] Stream failed, attempting failover...');
        console.log('[AudioProvider] Current candidate:', currentIndex + 1, '/', candidates.length);
        
        // Try next candidate
        if (currentIndex + 1 < candidates.length) {
          currentCandidateIndexRef.current++;
          const nextUrl = candidates[currentCandidateIndexRef.current];
          
          console.log('[AudioProvider] FAILOVER: Trying next URL:', nextUrl.substring(0, 60));
          
          try {
            preparingQueueRef.current = true;
            startStreamLoadTimer(requestId);
            setPlaybackState('loading');
            await TrackPlayer.reset();
            if (requestId !== globalPlayId) return;
            await TrackPlayer.add({
              id: currentStation._id || `station_${Date.now()}`,
              url: nextUrl,
              type: isHlsStream(nextUrl, currentStation) ? TrackType.HLS : TrackType.Default,
              title: currentStation.name || 'MegaRadio',
              artist: 'MegaRadio',
              album: getStationGenre(currentStation) || 'MegaRadio',
              artwork: getArtworkUrl(currentStation) || 'https://themegaradio.com/logo.png',
              duration: 86400, // Fake duration for skip buttons
              headers: { 'Icy-MetaData': '1', 'User-Agent': 'MegaRadio/1.0' },
            });
            if (requestId !== globalPlayId) return;
            preparingQueueRef.current = false;
            await TrackPlayer.play();
            if (requestId !== globalPlayId) return;
            
            console.log('[AudioProvider] FAILOVER: Successfully switched to candidate', currentCandidateIndexRef.current + 1);
            setStreamUrl(nextUrl);
            return; // Don't set error state
          } catch (fallbackError) {
            console.error('[AudioProvider] FAILOVER: Candidate also failed:', fallbackError);
          } finally {
            if (requestId === globalPlayId) preparingQueueRef.current = false;
          }
        } else {
          console.log('[AudioProvider] FAILOVER: All candidates exhausted');
        }
      }
      
      // All failover attempts failed
      if (requestId !== globalPlayId) return;
      clearStreamLoadTimer();
      currentPlayingStationId = null;
      setError('Stream playback error - all URLs failed');
      setPlaybackState('error');
    }
    
    // Handle ICY metadata from stream (live song info — zero server load)
    if (event.type === Event.PlaybackMetadataReceived || event.type === Event.MetadataCommonReceived) {
      console.log('[AudioProvider] ICY metadata received:', event);
      const station = usePlayerStore.getState().currentStation;
      if (!station) return;
      
      // Extract metadata from event
      const metadata = (event as any).metadata || event;
      const rawTitle = metadata.title || metadata.commonMetadata?.title || '';
      const rawArtist = metadata.artist || metadata.commonMetadata?.artist || '';
      
      if(isMetadataAdvertisement(metadata)) return;
      if (!rawTitle && !rawArtist) return;
      const validated = normalizeNowPlaying({ title: rawTitle, artist: rawArtist }, station.name);
      if (!validated || !currentTrackText(validated, station.name, station.country)) {
        // A server error is not a song, and must not disable the API fallback.
        icyMetadataActiveRef.current = false;
        icyMetadataAtRef.current = 0;
        if(!validated&&!currentTrackText(usePlayerStore.getState().nowPlaying,station.name,station.country))usePlayerStore.getState().setMetadataStatus('error');
        return;
      }
      
      // Parse "Artist - Title" format
      let songTitle = validated.title || '';
      let artistName = validated.artist || '';
      
      if (songTitle && songTitle.includes(' - ') && !artistName) {
        const parts = songTitle.split(' - ');
        artistName = parts[0].trim();
        songTitle = parts.slice(1).join(' - ').trim();
      }
      
      // Skip empty or station-name-only metadata
      if (!songTitle || songTitle === station.name) {
        if (!artistName) return;
      }
      
      console.log('[AudioProvider] ICY parsed:', { title: songTitle, artist: artistName });
      
      // Prefer fresh native ICY metadata; stale events allow bounded REST recovery.
      icyMetadataActiveRef.current = true;
      icyMetadataAtRef.current = Date.now();
      
      // Track song changes for stats
      const metadataKey = `${songTitle}-${artistName}`;
      if (metadataKey !== lastMetadataTitle && lastMetadataTitle !== null) {
        console.log('[AudioProvider] ICY: New song detected');
        statsService.incrementMusicPlayed().catch(console.error);
      }
      lastMetadataTitle = metadataKey;
      
      // Update UI state
      setNowPlaying({
        title: songTitle || station.name,
        artist: artistName,
        song: songTitle,
        station: station.name,
        timestamp: Date.now(),
      });
      
      // Add to Song History
      if (artistName && songTitle && songTitle !== 'Live Stream' && songTitle !== station.name) {
        try {
          const { useSongHistoryStore } = require('../store/songHistoryStore');
          useSongHistoryStore.getState().addEntry({
            title: songTitle,
            artist: artistName,
            stationName: station.name,
            stationId: station._id || '',
            stationFavicon: station.favicon || station.logo,
          });
        } catch (e) {
          // Non-blocking
        }
      }
      
      // Update lock screen via helper (DRY)
      if (Platform.OS !== 'web') {
        try {
          // Inline artwork + genre resolution (helper defined after this hook)
          let artworkUrl = 'https://themegaradio.com/logo.png';
          if (station.favicon && station.favicon.length > 0) {
            artworkUrl = station.favicon;
          } else if (station.logo && station.logo.length > 0) {
            artworkUrl = station.logo;
          }
          if (artworkUrl.startsWith('http://')) {
            artworkUrl = artworkUrl.replace('http://', 'https://');
          }
          
          let albumName = 'MegaRadio';
          if (station.tags && typeof station.tags === 'string' && station.tags.length > 0) {
            const firstTag = station.tags.split(',')[0].trim();
            if (firstTag) albumName = firstTag.charAt(0).toUpperCase() + firstTag.slice(1);
          } else if (station.genres && Array.isArray(station.genres) && station.genres.length > 0 && station.genres[0]) {
            albumName = station.genres[0];
          } else if (station.country && typeof station.country === 'string') {
            albumName = station.country;
          }
          
          await TrackPlayer.updateNowPlayingMetadata({
            title: songTitle || station.name || 'MegaRadio',
            artist: artistName || 'MegaRadio',
            album: albumName,
            artwork: artworkUrl,
          });
        } catch (e) {
          console.log('[AudioProvider] Could not update lock screen:', e);
        }
      }
    }
  });

  // Start stats tracking interval when playing
  const startStatsTracking = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    statsIntervalRef.current = setInterval(() => {
      statsService.updateListeningTime().catch(console.error);
      console.log('[AudioProvider] Stats: Updated listening time');
    }, 60000);
    
    console.log('[AudioProvider] Stats: Started tracking interval');
  }, []);

  // Stop stats tracking interval
  const stopStatsTracking = useCallback(() => {
    if(metadataFallbackTimerRef.current){clearTimeout(metadataFallbackTimerRef.current);metadataFallbackTimerRef.current=null;}
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
      console.log('[AudioProvider] Stats: Stopped tracking interval');
    }
    if (nowPlayingIntervalRef.current) {
      clearInterval(nowPlayingIntervalRef.current);
      nowPlayingIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStatsTracking();
    };
  }, [stopStatsTracking]);

  // Initialize Track Player
  useEffect(() => {
    // Skip on web
    if (Platform.OS === 'web') {
      console.log('[AudioProvider] Web platform - Track Player not available');
      setIsReady(true);
      return;
    }
    
    // DEFERRED setup: don't compete with Firebase/AdMob/fonts during the
    // launch window. UI is never gated on this — playStation() lazily sets up
    // the player if this hasn't finished yet.
    setIsReady(true);
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        setupTrackPlayer()
          .then((success) => {
            if (success) console.log('[AudioProvider] Ready to play!');
          })
          .catch((e) => console.error('[AudioProvider] Track Player setup error:', e));
      });
    }, 1500);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !trackPlayerInitialized) void setupTrackPlayer();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);

  // Resolve stream URL helper - returns { url, candidates } for fallback support
  // Backend Developer Recommendation:
  // 1. urlResolved varsa ve boş değilse → urlResolved kullan
  // 2. url .pls/.m3u/.m3u8/.asx ise → /api/stream/resolve kullan
  // 3. Hiçbiri yoksa → url kullan
  // 
  // HTTP streams: Native'de direkt çalışır (usesCleartextTraffic=true)
  // Proxy sadece Web için gerekli (mixed content)
  //
  // HD STREAM GATING:
  // Premium users get urlResolved (typically higher bitrate) or urlHigh
  // Free users get url (standard quality) when available
  
  // Helper to check if URL is a playlist
  const isPlaylistUrl = useCallback(isPlaylistStream, []);
  
  // Store candidates for fallback - IMPROVED with retry count tracking
  const streamCandidatesRef = useRef<string[]>([]);
  const currentCandidateIndexRef = useRef<number>(0);
  const failoverRetryCountRef = useRef<number>(0);
  const MAX_FAILOVER_RETRIES = 3; // Max retries per candidate
  
  const resolveStreamUrl = useCallback(async (station: Station): Promise<string | null> => {
    const requestId = globalPlayId;
    // Get urlResolved - API returns camelCase "urlResolved"
    const urlResolved = (station as any).urlResolved || station.url_resolved;
    const originalUrl = station.url;
    // Check for backup URLs from station data
    const urlBackup = (station as any).urlBackup || (station as any).url_backup;
    const urlAlternatives = (station as any).urlAlternatives || (station as any).url_alternatives || [];
    
    console.log('[AudioProvider] Resolving stream for:', station.name);
    console.log('[AudioProvider] urlResolved:', urlResolved ? urlResolved.substring(0, 60) : 'EMPTY');
    console.log('[AudioProvider] originalUrl:', originalUrl ? originalUrl.substring(0, 60) : 'EMPTY');
    console.log('[AudioProvider] urlBackup:', urlBackup ? urlBackup.substring(0, 60) : 'NONE');
    
    // Reset candidates and retry count
    streamCandidatesRef.current = [];
    currentCandidateIndexRef.current = 0;
    failoverRetryCountRef.current = 0;
    
    // Determine which URL to use based on premium status (HD gating)
    // Premium users get highest quality (urlResolved), free users get standard (url)
    let streamUrl: string;
    const premiumStore = require('../store/premiumStore').usePremiumStore;
    const hasHD = premiumStore.getState().hasFeature('hd_stream');
    
    // Check for explicit high/low quality URLs
    const urlHigh = (station as any).urlHigh || (station as any).url_high;
    const urlLow = (station as any).urlLow || (station as any).url_low;
    
    if (hasHD) {
      // Premium: prefer highest quality → urlHigh > urlResolved > originalUrl
      streamUrl = urlHigh || ((urlResolved && urlResolved.trim() !== '') ? urlResolved : originalUrl);
      console.log('[AudioProvider] HD Stream: Premium user, using high quality URL');
    } else {
      // Free: prefer standard quality → urlLow > originalUrl > urlResolved
      streamUrl = urlLow || originalUrl || urlResolved;
      console.log('[AudioProvider] Standard Stream: Free user, using standard URL');
    }
    
    if (!streamUrl) {
      console.error('[AudioProvider] No valid URL found for station:', station.name);
      return null;
    }
    
    // NATIVE APPS
    if (Platform.OS !== 'web') {
      // Check if URL is a playlist that needs resolution
      if (isPlaylistUrl(streamUrl)) {
        // PRE-WARM HIT: startup already resolved this station's playlist — zero-delay play
        if (prewarmedResolve && prewarmedResolve.stationId === station._id && prewarmedResolve.candidates.length > 0) {
          streamCandidatesRef.current = prewarmedResolve.candidates;
          const prewarmedUrl = prewarmedResolve.candidates[0];
          prewarmedResolve = null; // one-shot
          console.log('[AudioProvider] Native: Using PRE-WARMED resolve:', prewarmedUrl.substring(0, 60));
          return prewarmedUrl;
        }
        console.log('[AudioProvider] Native: Playlist detected (.pls/.m3u/.asx), resolving...');
        try {
          const streamData = await stationService.resolveStream(streamUrl);
          if (requestId !== globalPlayId) return null;
          if (streamData.candidates && streamData.candidates.length > 0) {
            // Store all candidates for fallback
            streamCandidatesRef.current = streamData.candidates;
            const resolvedUrl = streamData.candidates[0];
            console.log('[AudioProvider] Native: Resolved to:', resolvedUrl.substring(0, 60));
            console.log('[AudioProvider] Native: Total candidates:', streamData.candidates.length);
            return resolvedUrl;
          }
        } catch (error) {
          console.log('[AudioProvider] Native: Resolve failed:', error);
          // Fallback: try original URL if we used urlResolved
          if (urlResolved && originalUrl && !isPlaylistUrl(originalUrl)) {
            console.log('[AudioProvider] Native: Falling back to original URL');
            streamCandidatesRef.current = [originalUrl];
            return originalUrl;
          }
        }
      }
      
      // Direct stream URL - build candidates list for fallback
      // Index zero MUST match the chosen free/premium URL, including urlLow/High.
      const candidates = buildStreamCandidates(streamUrl, urlResolved, originalUrl,
        urlBackup, Array.isArray(urlAlternatives) ? urlAlternatives : []);
      streamCandidatesRef.current = candidates;
      
      console.log('[AudioProvider] Native: Stream candidates:', candidates.length);
      console.log('[AudioProvider] Native: Using primary URL:', streamUrl.substring(0, 60));
      return streamUrl;
    }
    
    // WEB: Need to handle mixed content (HTTP on HTTPS page)
    try {
      // Check if playlist needs resolution
      if (isPlaylistUrl(streamUrl)) {
        console.log('[AudioProvider] Web: Playlist detected, resolving...');
        const streamData = await stationService.resolveStream(streamUrl);
        if (requestId !== globalPlayId) return null;
        if (streamData.candidates && streamData.candidates.length > 0) {
          streamCandidatesRef.current = streamData.candidates;
          streamUrl = streamData.candidates[0];
        }
      }
      
      // Apply proxy for HTTP URLs on web
      if (streamUrl.startsWith('http://')) {
        console.log('[AudioProvider] Web: HTTP stream, using proxy');
        return stationService.getProxyUrl(streamUrl);
      }
      
      console.log('[AudioProvider] Web: Using HTTPS stream directly');
      return streamUrl;
      
    } catch (error) {
      console.log('[AudioProvider] Web: Resolution error:', error);
      
      // Fallback with proxy if needed
      if (streamUrl.startsWith('http://')) {
        return stationService.getProxyUrl(streamUrl);
      }
      return streamUrl;
    }
  }, [isPlaylistUrl]);
  
  // Try next candidate URL when playback fails
  const tryNextCandidate = useCallback(async (): Promise<string | null> => {
    currentCandidateIndexRef.current++;
    const candidates = streamCandidatesRef.current;
    
    if (currentCandidateIndexRef.current < candidates.length) {
      const nextUrl = candidates[currentCandidateIndexRef.current];
      console.log('[AudioProvider] Trying next candidate:', currentCandidateIndexRef.current + 1, '/', candidates.length);
      console.log('[AudioProvider] Next URL:', nextUrl.substring(0, 60));
      return nextUrl;
    }
    
    console.log('[AudioProvider] No more candidates to try');
    return null;
  }, []);

  // Helper to get artwork URL from station
  const getArtworkUrl = useCallback((station: Station): string => {
    const DEFAULT_LOGO = 'https://themegaradio.com/logo.png';
    
    // Helper to check if value is a valid non-empty string
    const isValidUrl = (url: string | undefined | null): boolean => {
      return typeof url === 'string' && url.trim().length > 0;
    };
    
    let artworkUrl = DEFAULT_LOGO;
    
    // Check favicon first, then logo
    if (isValidUrl(station.favicon) && station.favicon!.startsWith('http')) {
      artworkUrl = station.favicon!;
    } else if (isValidUrl(station.logo) && station.logo!.startsWith('http')) {
      artworkUrl = station.logo!;
    } else if (isValidUrl(station.favicon) && station.favicon!.startsWith('/')) {
      artworkUrl = `https://themegaradio.com${station.favicon}`;
    } else if (isValidUrl(station.logo) && station.logo!.startsWith('/')) {
      artworkUrl = `https://themegaradio.com${station.logo}`;
    }
    
    // Ensure HTTPS for lock screen compatibility
    if (artworkUrl.startsWith('http://')) {
      artworkUrl = artworkUrl.replace('http://', 'https://');
    }
    
    // Final fallback check
    if (!isValidUrl(artworkUrl)) {
      return DEFAULT_LOGO;
    }
    
    return artworkUrl;
  }, []);

  // Helper to get genre/album from station (for metadata display) - null-safe
  const getStationGenre = useCallback((station: Station): string => {
    // Priority: tags (first tag) > genres (first genre) > country > 'MegaRadio'
    if (station.tags && typeof station.tags === 'string' && station.tags.length > 0) {
      const firstTag = station.tags.split(',')[0].trim();
      if (firstTag && firstTag.length > 0) {
        return firstTag.charAt(0).toUpperCase() + firstTag.slice(1); // Capitalize
      }
    }
    if (station.genres && Array.isArray(station.genres) && station.genres.length > 0 && station.genres[0]) {
      return station.genres[0];
    }
    if (station.country && typeof station.country === 'string' && station.country.length > 0) {
      return station.country;
    }
    return 'MegaRadio';
  }, []);

  // STARTUP PRE-WARM (fully async, fire-and-forget — never blocks UI):
  // prefetch last played station's logo into expo-image cache and pre-resolve
  // its playlist URL so the first play tap starts with zero network delay
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const raw = await AsyncStorage.getItem(LAST_PLAYED_STATION_KEY);
          if (!raw) return;
          const station: Station = JSON.parse(raw);
          if (!station || !station._id) return;
          console.log('[AudioProvider] Pre-warming last played station:', station.name);

          // 1) Logo → expo-image memory/disk cache (also used by lock screen artwork)
          try {
            const { Image: ExpoImage } = require('expo-image');
            const artwork = getArtworkUrl(station);
            if (artwork) {
              ExpoImage.prefetch(artwork, { cachePolicy: 'memory-disk' })?.catch?.(() => {});
            }
          } catch (e) {}

          // 2) Playlist stream resolve (the only network cost at play time)
          const urlResolved = (station as any).urlResolved || station.url_resolved;
          const primaryUrl = (urlResolved && urlResolved.trim() !== '') ? urlResolved : station.url;
          if (primaryUrl && isPlaylistUrl(primaryUrl)) {
            const streamData = await stationService.resolveStream(primaryUrl);
            if (streamData?.candidates?.length > 0) {
              prewarmedResolve = { stationId: station._id, candidates: streamData.candidates };
              console.log('[AudioProvider] Pre-warm: playlist resolved,', streamData.candidates.length, 'candidates ready');
            }
          }
        } catch (e) {
          console.log('[AudioProvider] Pre-warm failed (non-blocking):', (e as any)?.message || e);
        }
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [getArtworkUrl, isPlaylistUrl]);

  // Update lock screen metadata helper
  const updateLockScreenMetadata = useCallback(async (
    station: Station,
    songTitle: string,
    artistName: string
  ) => {
    if (Platform.OS === 'web') return;
    
    try {
      const artworkUrl = getArtworkUrl(station);
      const albumName = getStationGenre(station);
      
      // Ensure all values are non-null strings
      const newMetadata = {
        title: (songTitle && songTitle.length > 0) ? songTitle : (station.name || 'MegaRadio'),
        artist: (artistName && artistName.length > 0) ? artistName : 'MegaRadio',
        album: (albumName && albumName.length > 0) ? albumName : 'MegaRadio',
        artwork: (artworkUrl && artworkUrl.length > 0) ? artworkUrl : 'https://themegaradio.com/logo.png',
      };
      
      console.log('[AudioProvider] Updating lock screen metadata:', newMetadata);
      
      // Update NOW PLAYING metadata (for live streams)
      await TrackPlayer.updateNowPlayingMetadata(newMetadata);
      
      // Also update track metadata for consistency
      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      if (activeIndex !== null && activeIndex !== undefined) {
        await TrackPlayer.updateMetadataForTrack(activeIndex, newMetadata);
      }
      
      console.log('[AudioProvider] Lock screen updated:', songTitle, '-', artistName);
    } catch (e) {
      console.log('[AudioProvider] Could not update lock screen:', e);
    }
  }, [getArtworkUrl, getStationGenre]);

  // Fetch now playing helper - updates both UI state and lock screen
  // API returns: { station: { id, name, url }, metadata: { title?, artist?, station?, genre? } }
  const fetchNowPlaying = useCallback(async (stationId: string) => {
    const station = usePlayerStore.getState().currentStation;
    if (!station || station._id !== stationId) return;
    const metadataGeneration=globalPlayId;
    if(metadataPendingGenerationRef.current===metadataGeneration)return;
    metadataPendingGenerationRef.current=metadataGeneration;
    try {
      // Use the correct metadata API endpoint via stationService
      const response = await stationService.getNowPlaying(stationId);
      console.log('[AudioProvider] Now Playing response:', response);
      
      // API returns { station: {...}, metadata: {...} } format
      if (globalPlayId!==metadataGeneration || usePlayerStore.getState().currentStation?._id !== stationId || (icyMetadataActiveRef.current && hasFreshIcyMetadata(icyMetadataAtRef.current))) return;
      const state=usePlayerStore.getState();
      const update=resolveNowPlaying(response,state.nowPlaying,station.name,station.country);
      if(update.retained)return;
      const metadataObj=update.metadata;
      
      // Check if we have valid metadata (title or artist)
      if (metadataObj && currentTrackText(metadataObj,station.name,station.country)) {
        const songTitle = metadataObj.title || station.name;
        const artistName = metadataObj.artist || '';
        const genre = metadataObj.album || '';
        
        // Build display text based on available data
        let displayText = songTitle;
        if (artistName && songTitle !== station.name) {
          displayText = `${artistName} - ${songTitle}`;
        }
        
        console.log('[AudioProvider] Metadata found:', { title: songTitle, artist: artistName, genre });
        
        // Check if song changed (new metadata) - increment music played count
        const newMetadataKey = `${songTitle}-${artistName}`;
        if (lastMetadataTitle !== newMetadataKey && lastMetadataTitle !== null) {
          console.log('[AudioProvider] New song detected, incrementing music played count');
          statsService.incrementMusicPlayed().catch(console.error);
          
          // Add to Song History (only for actual songs with artist info)
          if (artistName && songTitle && songTitle !== 'Live Stream' && songTitle !== station.name) {
            try {
              const { useSongHistoryStore } = require('../store/songHistoryStore');
              useSongHistoryStore.getState().addEntry({
                title: songTitle,
                artist: artistName,
                stationName: station.name,
                stationId: station._id || '',
                stationFavicon: station.favicon || station.logo,
              });
            } catch (e) {
              // Non-blocking - Song History is a premium feature
            }
          }
        }
        lastMetadataTitle = newMetadataKey;
        
        // Update UI state with full metadata
        setNowPlaying({
          title: songTitle,
          artist: artistName,
          song: songTitle,
          station: station.name,
          album: genre,
          timestamp: Date.now(),
        });
        
        // Update lock screen on native
        await updateLockScreenMetadata(
          station, 
          songTitle, 
          artistName || station.country || 'MegaRadio'
        );
        return;
      }
      
      setNowPlaying(null);
      state.setMetadataStatus(update.status);
      await updateLockScreenMetadata(station,station.name,station.country||'Live Radio');
    } catch (err) {
      if(globalPlayId!==metadataGeneration || usePlayerStore.getState().currentStation?._id!==stationId || (icyMetadataActiveRef.current&&hasFreshIcyMetadata(icyMetadataAtRef.current)))return;
      const state=usePlayerStore.getState();
      const update=resolveNowPlaying(null,state.nowPlaying,station.name,station.country);
      if(!update.retained){setNowPlaying(update.metadata);state.setMetadataStatus(update.status);}
    } finally {if(metadataPendingGenerationRef.current===metadataGeneration)metadataPendingGenerationRef.current=null;}
  }, [setNowPlaying, updateLockScreenMetadata]);

  // ============================================
  // PLAY STATION - THE CORE FUNCTION
  // ============================================
  const playStation = useCallback(async (station: Station, options: { preserveRecommendations?: boolean; advertising?: boolean } = {}) => {
    console.log('[AudioProvider] ========================================');
    console.log('[AudioProvider] PLAY STATION:', station.name);
    console.log('[AudioProvider] Station ID:', station._id);
    console.log('[AudioProvider] Current playing:', currentPlayingStationId);
    console.log('[AudioProvider] ========================================');

    // Web fallback - just update UI state
    if (Platform.OS === 'web') {
      console.log('[AudioProvider] Web platform - playback not supported');
      setCurrentStation(station);
      usePlayerStore.getState().setMetadataStatus('loading');
      setMiniPlayerVisible(true);
      return;
    }

    // Same station? Toggle play/pause
    if (currentPlayingStationId === station._id && usePlayerStore.getState().playbackState !== 'error') {
      console.log('[AudioProvider] Same station - toggling');
      if (preparingQueueRef.current) return;
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      return;
    }

    const myPlayId = ++globalPlayId;
    // A foreground station selection is a natural break. Await dismissal
    // before starting the next stream; never schedule an ad over live playback.
    try {
      if (options.advertising === false) await adMobService.waitForPresentation();
      else await adMobService.onStationChange();
    } catch (error) {
      console.log('[AudioProvider] Ad unavailable; continuing station selection');
    }
    if (globalPlayId !== myPlayId) return;

    // RateUs: track station play (triggers prompt after 3 plays)
    try {
      const { rateUsService } = require('../services/rateUsService');
      rateUsService.trackStationPlay().catch(() => {});
    } catch (e) {
      // non-blocking
    }

    // Continue only the latest requested station after the ad boundary.
    console.log('[AudioProvider] New PlayID:', myPlayId);
    preparingQueueRef.current = true;
    clearStreamLoadTimer();
    startStreamLoadTimer(myPlayId);
    setPlaybackState('loading');
    setError(null);
    setCurrentStation(station);
    setMiniPlayerVisible(true);

    try {
      if (!trackPlayerInitialized) {
        const setupOk = await setupTrackPlayer();
        if (globalPlayId !== myPlayId) return;
        if (!setupOk) throw new Error('Audio player could not be initialized');
      }
      // STEP 1: STOP CURRENT PLAYBACK & CLEAR OLD METADATA
      console.log('[AudioProvider] STEP 1: Stopping current playback...');
      await TrackPlayer.reset();
      if (globalPlayId !== myPlayId) return;
      
      // IMPORTANT: Clear previous station's metadata immediately
      // This prevents showing old station's info while loading new one
      setNowPlaying(null);

      // Record listening time for previous station
      if (listeningStartTime && currentPlayingStationId) {
        const duration = Math.floor(
          (new Date().getTime() - listeningStartTime.getTime()) / 1000
        );
        if (duration > 5) {
          userService.recordListening(
            currentPlayingStationId,
            duration,
            listeningStartTime.toISOString()
          ).catch(() => {});
        }
        listeningStartTime = null;
      }

      icyMetadataActiveRef.current=false; icyMetadataAtRef.current=0;
      // STEP 2: Update UI immediately
      console.log('[AudioProvider] STEP 2: Updating UI...');
      setPlaybackState('loading');
      setError(null);
      setCurrentStation(station);
      usePlayerStore.getState().setMetadataStatus('loading');
      setMiniPlayerVisible(true);
      currentPlayingStationId = station._id;

      // Record click (non-blocking)
      stationService.recordClick(station._id).catch(() => {});

      // STEP 3: Resolve stream URL
      console.log('[AudioProvider] STEP 3: Resolving stream URL...');
      const url = await resolveStreamUrl(station);
      if (!url) {
        throw new Error('Could not resolve stream URL');
      }

      // Check if still current request
      if (globalPlayId !== myPlayId) {
        console.log('[AudioProvider] Request stale, aborting');
        return;
      }

      console.log('[AudioProvider] Stream URL:', url.substring(0, 60) + '...');
      setStreamUrl(url);

      // STEP 4: Get artwork URL using helper
      const artworkUrl = getArtworkUrl(station);
      console.log('[AudioProvider] Artwork URL:', artworkUrl);

      // STEP 5: Add track to player with metadata
      // For iOS Control Center Next/Previous to be ENABLED:
      // - DON'T use isLiveStream: true (iOS hides skip buttons for live streams)
      // - Use a very long duration to simulate a long track
      // - Add placeholder tracks before and after
      console.log('[AudioProvider] STEP 5: Adding track with metadata...');
      
      // Long duration (24 hours in seconds) - tricks iOS into showing skip buttons
      const fakeDuration = 86400;
      
      // Ensure all metadata values are non-null
      const safeAlbum = getStationGenre(station) || 'MegaRadio';
      const safeArtwork = artworkUrl || 'https://themegaradio.com/logo.png';
      const safeTitle = station.name || 'MegaRadio';
      const safeId = station._id || `station_${Date.now()}`;
      
      // ICY metadata headers — tells stream server to send song info inline
      const icyHeaders = {
        'Icy-MetaData': '1',
        'User-Agent': 'MegaRadio/1.0',
      };
      
      // Add a "previous" placeholder (will be replaced when user presses Previous)
      await TrackPlayer.add({
        id: 'placeholder_previous',
        url: url,
        type: isHlsStream(url, station) ? TrackType.HLS : TrackType.Default,
        title: 'Previous Station',
        artist: 'MegaRadio',
        album: safeAlbum,
        artwork: safeArtwork,
        duration: fakeDuration,
        headers: icyHeaders,
      });
      if (globalPlayId !== myPlayId) return;
      
      // Add the actual current station
      await TrackPlayer.add({
        id: safeId,
        url: url,
        type: isHlsStream(url, station) ? TrackType.HLS : TrackType.Default,
        title: safeTitle,
        artist: 'MegaRadio',
        album: safeAlbum,
        artwork: safeArtwork,
        duration: fakeDuration,
        headers: icyHeaders,
      });
      if (globalPlayId !== myPlayId) return;
      
      // Add a "next" placeholder (will be replaced when user presses Next)
      await TrackPlayer.add({
        id: 'placeholder_next',
        url: url,
        type: isHlsStream(url, station) ? TrackType.HLS : TrackType.Default,
        title: 'Next Station',
        artist: 'MegaRadio',
        album: safeAlbum,
        artwork: safeArtwork,
        duration: fakeDuration,
        headers: icyHeaders,
      });
      if (globalPlayId !== myPlayId) return;
      
      // Skip to the actual track (index 1)
      await TrackPlayer.skip(1);
      if (globalPlayId !== myPlayId) return;
      preparingQueueRef.current = false;

      // STEP 6: Start playback
      console.log('[AudioProvider] STEP 6: Starting playback...');
      await TrackPlayer.play();
      if (globalPlayId !== myPlayId) return;
      
      listeningStartTime = new Date();

      console.log('[AudioProvider] ========== NOW PLAYING ==========');

      // History is recorded by the shared store on confirmed playing events.
      fetchNowPlaying(station._id);

      // Save as last played station
      try {
        await AsyncStorage.setItem(LAST_PLAYED_STATION_KEY, JSON.stringify(station));
        console.log('[AudioProvider] Saved as last played station');
      } catch (e) {
        console.log('[AudioProvider] Failed to save last played:', e);
      }

      // STEP 7: Start statistics tracking
      console.log('[AudioProvider] STEP 7: Starting statistics tracking...');
      try {
        // The account-aware playing effect owns sessions and unique counts.
        startStatsTracking();
        console.log('[AudioProvider] Stats session started for:', station.name);
      } catch (e) {
        console.log('[AudioProvider] Failed to start stats session:', e);
      }

      // STEP 8: ICY-first metadata strategy
      // ICY metadata comes directly from the stream (zero server load)
      // Fallback: REST API polling only if ICY not available after 20 seconds
      console.log('[AudioProvider] STEP 8: ICY metadata active, API fallback in 20s...');
      if (nowPlayingIntervalRef.current) {
        clearInterval(nowPlayingIntervalRef.current);
      }
      // Initial metadata fetch via API (fast first-display)
      fetchNowPlaying(station._id);
      // Keep the bounded fallback alive even when ICY was initially healthy.
      // Skip fresh ICY; recover after invalid frames or stalled native metadata.
      if(metadataFallbackTimerRef.current)clearTimeout(metadataFallbackTimerRef.current);
      const stationIdForPolling=station._id;
      metadataFallbackTimerRef.current=setTimeout(()=>{
        metadataFallbackTimerRef.current=null;
        if(globalPlayId!==myPlayId || currentPlayingStationId!==stationIdForPolling)return;
        const refresh=()=>{
          if(globalPlayId===myPlayId && currentPlayingStationId===stationIdForPolling &&
            !(icyMetadataActiveRef.current&&hasFreshIcyMetadata(icyMetadataAtRef.current)))void fetchNowPlaying(stationIdForPolling);
        };
        refresh();
        nowPlayingIntervalRef.current=setInterval(refresh,60000);
      },20000);

      // STEP 9: Save current station and fetch similar stations for background service
      // This enables Next/Previous controls in lock screen and Control Center
      console.log('[AudioProvider] STEP 9: Saving station data for background controls...');
      try {
        // Save current station for background service
        await AsyncStorage.setItem(CURRENT_STATION_KEY, JSON.stringify(station));
        
        // Add to playback history for Previous button
        const historyJson = await AsyncStorage.getItem(PLAYBACK_HISTORY_KEY);
        let history = historyJson ? JSON.parse(historyJson) : [];
        history = history.filter((s: Station) => s._id !== station._id);
        history.unshift(station);
        history = history.slice(0, 50);
        await AsyncStorage.setItem(PLAYBACK_HISTORY_KEY, JSON.stringify(history));
        
        // A manual selection starts new recommendations. Advancing the existing
        // queue must retain its index, otherwise Watch Next repeats its first item.
        if (!options.preserveRecommendations) {
          await AsyncStorage.setItem(SIMILAR_INDEX_KEY, '-1');
          stationService.getSimilarStations(station._id, 10).then(async (similarStations) => {
            if (globalPlayId === myPlayId && similarStations && similarStations.length > 0) {
              await AsyncStorage.setItem(SIMILAR_STATIONS_KEY, JSON.stringify(similarStations));
              console.log('[AudioProvider] Saved', similarStations.length, 'similar stations for Next button');
            }
          }).catch((e) => {
            console.log('[AudioProvider] Could not fetch similar stations:', e);
          });
        }
        
        console.log('[AudioProvider] Background controls data saved!');
      } catch (e) {
        console.log('[AudioProvider] Failed to save background data:', e);
      }

    } catch (error) {
      if (globalPlayId !== myPlayId) return;
      console.error('[AudioProvider] Play failed:', error);
      
      // Try next candidate if available (Backend recommendation: fallback to candidates[1], candidates[2], etc.)
      const nextUrl = await tryNextCandidate();
      if (nextUrl) {
        console.log('[AudioProvider] Retrying with next candidate...');
        try {
          preparingQueueRef.current = true;
          await TrackPlayer.reset();
          if (globalPlayId !== myPlayId) return;
          await TrackPlayer.add({
            id: station._id || `station_${Date.now()}`,
            url: nextUrl,
            type: isHlsStream(nextUrl, station) ? TrackType.HLS : TrackType.Default,
            title: station.name || 'MegaRadio',
            artist: 'MegaRadio',
            album: getStationGenre(station) || 'MegaRadio',
            artwork: getArtworkUrl(station) || 'https://themegaradio.com/logo.png',
            isLiveStream: true,
            headers: { 'Icy-MetaData': '1', 'User-Agent': 'MegaRadio/1.0' },
          });
          if (globalPlayId !== myPlayId) return;
          preparingQueueRef.current = false;
          await TrackPlayer.play();
          if (globalPlayId !== myPlayId) return;
          console.log('[AudioProvider] Fallback playback started successfully');
          
          // Update stream URL and continue
          setStreamUrl(nextUrl);
          listeningStartTime = new Date();
          
          // Background tasks
          fetchNowPlaying(station._id);
          return;
        } catch (fallbackError) {
          console.error('[AudioProvider] Fallback also failed:', fallbackError);
        }
      }
      
      if (globalPlayId !== myPlayId) return;
      clearStreamLoadTimer();
      currentPlayingStationId = null;
      setError(error instanceof Error ? error.message : 'Failed to play');
      setPlaybackState('error');
    } finally {
      if (globalPlayId === myPlayId) preparingQueueRef.current = false;
    }
  }, [resolveStreamUrl, tryNextCandidate, getArtworkUrl, setCurrentStation, setPlaybackState, setStreamUrl, setError, setMiniPlayerVisible, fetchNowPlaying, startStatsTracking, clearStreamLoadTimer, startStreamLoadTimer]);

  // Stop playback completely
  const stopPlayback = useCallback(async () => {
    console.log('[AudioProvider] ========== STOP PLAYBACK ==========');
    globalPlayId++;
    clearStreamLoadTimer();
    preparingQueueRef.current = false;
    setPlaybackState('idle');
    setMiniPlayerVisible(false);
    
    // Stop stats tracking
    stopStatsTracking();
    try {
      void statsService.endSession().catch(() => {});
      console.log('[AudioProvider] Stats session ended');
    } catch (e) {
      console.log('[AudioProvider] Failed to end stats session:', e);
    }
    
    // Record listening time
    if (listeningStartTime && currentPlayingStationId) {
      const duration = Math.floor(
        (new Date().getTime() - listeningStartTime.getTime()) / 1000
      );
      if (duration > 5) {
        userService.recordListening(
          currentPlayingStationId,
          duration,
          listeningStartTime.toISOString()
        ).catch(() => {});
      }
      listeningStartTime = null;
    }

    currentPlayingStationId = null;

    // Web check
    if (Platform.OS === 'web') {
      setPlaybackState('idle');
      setMiniPlayerVisible(false);
      return;
    }

    try {
      await TrackPlayer.reset();
    } catch {}

    setPlaybackState('idle');
    setMiniPlayerVisible(false);
  }, [setPlaybackState, setMiniPlayerVisible, stopStatsTracking, clearStreamLoadTimer]);

  // Pause
  const pause = useCallback(async () => {
    console.log('[AudioProvider] Pause');
    clearStreamLoadTimer();
    if (Platform.OS === 'web') {
      setPlaybackState('paused');
      return;
    }
    try {
      await TrackPlayer.pause();
    } catch (e) {
      console.error('[AudioProvider] Pause error:', e);
    }
  }, [setPlaybackState, clearStreamLoadTimer]);

  // Resume
  const resume = useCallback(async () => {
    console.log('[AudioProvider] Resume');
    if (Platform.OS === 'web') {
      setPlaybackState('playing');
      return;
    }
    try {
      await TrackPlayer.play();
    } catch (e) {
      console.error('[AudioProvider] Resume error:', e);
    }
  }, [setPlaybackState]);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    console.log('[AudioProvider] Toggle play/pause');
    if (storePlaybackState === 'loading' || storePlaybackState === 'buffering') {
      await stopPlayback();
      return;
    }
    
    if (Platform.OS === 'web') {
      if (storePlaybackState === 'playing') {
        setPlaybackState('paused');
      } else if (currentStation) {
        setPlaybackState('playing');
      }
      return;
    }
    
    try {
      const state = await TrackPlayer.getPlaybackState();
      
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      } else if (state.state === State.Paused) {
        await TrackPlayer.play();
      } else if (currentStation) {
        // Try to play current station
        await playStation(currentStation);
      }
    } catch (e) {
      console.error('[AudioProvider] Toggle error:', e);
    }
  }, [storePlaybackState, currentStation, playStation, setPlaybackState, stopPlayback]);

  // Set volume
  const setVolume = useCallback(async (volume: number) => {
    if (Platform.OS === 'web') return;
    try {
      await TrackPlayer.setVolume(Math.max(0, Math.min(1, volume)));
    } catch {}
  }, []);

  // Determine if playing from playback state
  const isPlaying = playbackState.state === State.Playing;

  // ============================================
  // APPLE WATCH INTEGRATION
  // ============================================
  
  // Get favorites for Watch
  const { favorites } = useFavoritesStore();
  
  // Load recently played store from storage on mount (for CarPlay cold start)
  useEffect(() => {
    void useRecentlyPlayedStore.getState().loadFromStorage();
  }, []);

  // Send favorites to Watch when they change
  useEffect(() => {
    if (Platform.OS === 'ios') {
      watchService.updateFavorites(favorites);
    } else if (Platform.OS === 'android') {
      wearOSService.updateFavorites(favorites);
    }
  }, [favorites]);
  
  // Fetch and send genres to Watch on mount - use precomputed for country-specific data
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    
    const fetchAndSendGenres = async () => {
      try {
        const { useLocationStore } = await import('../store/locationStore');
        const locState = useLocationStore.getState();
        const countryCode = locState.countryCode;
        
        console.log('[AudioProvider] Fetching genres for Watch, countryCode:', countryCode);
        
        // Use precomputed genres with country code for country-specific data
        const result = await genreService.getPrecomputedGenres(countryCode || undefined, 40);
        
        if (result.success && result.data && result.data.length > 0) {
          const watchGenres = result.data.map((g: any) => ({
            name: g.name || g.title || '',
            slug: g.slug || g.name?.toLowerCase().replace(/\s+/g, '-') || '',
            icon: g.icon || 'radio',
            stationCount: g.stationCount || g.count || 0,
          }));
          if (Platform.OS === 'ios') {
            watchService.updateGenres(watchGenres);
          } else {
            wearOSService.updateGenres(watchGenres);
          }
          console.log('[AudioProvider] Sent', watchGenres.length, 'precomputed genres to Watch');
        } else {
          // Fallback to discoverable genres
          const genres = await genreService.getDiscoverableGenres();
          if (genres && genres.length > 0) {
            const watchGenres = genres.map((g: any) => ({
              name: g.name || g.title || '',
              slug: g.slug || g.name?.toLowerCase().replace(/\s+/g, '-') || '',
              icon: g.icon || 'radio',
              stationCount: g.stationCount || g.count || 0,
            }));
            if (Platform.OS === 'ios') {
              watchService.updateGenres(watchGenres);
            } else {
              wearOSService.updateGenres(watchGenres);
            }
            console.log('[AudioProvider] Sent', watchGenres.length, 'discoverable genres to Watch (fallback)');
          }
        }
      } catch (error) {
        console.log('[AudioProvider] Error fetching genres for Watch:', error);
      }
    };
    
    fetchAndSendGenres();
  }, []);
  
  // Send now playing info to Watch
  useEffect(() => {
    const nowPlayingData = watchNowPlaying;

    if (Platform.OS === 'ios') {
      watchService.updateNowPlaying({
        stationId: currentStation?._id,
        stationName: currentStation?.name,
        stationLogo: currentStation?.logo || currentStation?.favicon,
        songTitle: nowPlayingData?.title,
        artistName: nowPlayingData?.artist,
        isPlaying: isPlaying,
      });
    } else if (Platform.OS === 'android' && currentStation) {
      wearOSService.updateNowPlaying(
        currentStation,
        isPlaying,
        nowPlayingData?.title || '',
        nowPlayingData?.artist || ''
      );
    }
  }, [currentStation, isPlaying, watchNowPlaying]);
  
  // Update Watch playback state
  useEffect(() => {
    if (Platform.OS === 'ios') {
      watchService.updatePlaybackState(isPlaying);
    } else if (Platform.OS === 'android') {
      const nowPlayingData = usePlayerStore.getState().nowPlaying;
      wearOSService.updatePlaybackState(isPlaying, nowPlayingData?.title, nowPlayingData?.artist);
    }
  }, [isPlaying]);
  
  // Listen to Watch commands (iOS + Android)
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    
    // Unified command handler for both iOS Watch and Android Wear OS
    const handleWatchCommand = async (command: any) => {
      console.log('[AudioProvider] Watch command received:', command);
      
      if (['play', 'resume', 'togglePlayPause', 'next', 'nextStation', 'previous', 'previousStation', 'playStation'].includes(command.command)) {
        await adMobService.waitForPresentation();
      }
      switch (command.command) {
        case 'play':
          // Wear OS sends stationId in data field
          if (command.data && Platform.OS === 'android') {
            let station = favorites.find(
              (s: any) => (s._id || s.id) === command.data
            );
            if (!station) {
              try {
                station = await stationService.getStation(command.data);
              } catch (e) {
                console.log('[AudioProvider] Could not fetch station:', e);
              }
            }
            if (station) {
              await playStation(station, { advertising: false });
            }
          } else {
            resume();
          }
          break;
        case 'pause':
          pause();
          break;
        case 'resume':
          resume();
          break;
        case 'togglePlayPause':
          togglePlayPause();
          break;
        case 'next':
        case 'nextStation': {
          try {
            const similarJson = await AsyncStorage.getItem(SIMILAR_STATIONS_KEY);
            const savedStations = similarJson ? JSON.parse(similarJson) : [];
            const similarStations = Array.isArray(savedStations) ? savedStations : [];
            const activeStation = usePlayerStore.getState().currentStation;
            const activeId = activeStation?._id || activeStation?.id;
            
            if (similarStations.length > 0) {
              const indexJson = await AsyncStorage.getItem(SIMILAR_INDEX_KEY);
              const next = nextRecommendation<Station>(similarStations,
                activeId, indexJson ? parseInt(indexJson, 10) : -1);
              if (next) {
                await AsyncStorage.setItem(SIMILAR_INDEX_KEY, String(next.index));
                console.log('[AudioProvider] Watch: Playing next similar station:', next.station.name);
                await playStation(next.station, { preserveRecommendations: true, advertising: false });
                break;
              }
            }
            const currentIndex = favorites.findIndex(
              (s: any) => (s._id || s.id) === activeId
            );
            const nextFavorite = nextRecommendation<Station>(favorites, activeId, currentIndex);
            if (nextFavorite) await playStation(nextFavorite.station, { advertising: false });
          } catch (e) {
            console.log('[AudioProvider] Watch nextStation error:', e);
          }
          break;
        }
        case 'previous':
        case 'previousStation': {
          try {
            const historyJson = await AsyncStorage.getItem(PLAYBACK_HISTORY_KEY);
            const history = historyJson ? JSON.parse(historyJson) : [];
            
            if (history.length >= 2) {
              const previousStation = history[1];
              if (previousStation) {
                console.log('[AudioProvider] Watch: Playing previous station from history:', previousStation.name);
                await AsyncStorage.setItem(SIMILAR_INDEX_KEY, '-1');
                await playStation(previousStation, { advertising: false });
                break;
              }
            }
            const prevIndex = favorites.findIndex(
              (s: any) => (s._id || s.id) === (currentStation?._id || currentStation?.id)
            );
            if (prevIndex > 0) {
              await playStation(favorites[prevIndex - 1], { advertising: false });
            } else if (favorites.length > 0) {
              await playStation(favorites[favorites.length - 1], { advertising: false });
            }
          } catch (e) {
            console.log('[AudioProvider] Watch previousStation error:', e);
          }
          break;
        }
        case 'toggle_favorite':
          if (command.data) {
            try {
              const { useFavoritesStore } = await import('../store/favoritesStore');
              const store = useFavoritesStore.getState();
              let station = favorites.find(
                (s: any) => (s._id || s.id) === command.data
              );
              if (!station) {
                station = await stationService.getStation(command.data);
              }
              if (station) {
                await store.toggleFavorite(station);
              }
            } catch (e) {
              console.log('[AudioProvider] Watch toggle_favorite error:', e);
            }
          }
          break;
        case 'request_data':
          // Wear OS requests data refresh
          try {
            const data = command.data ? JSON.parse(command.data) : { type: 'all' };
            if (await handleWearStationRequest(data, async genre => {
              const { useLocationStore } = await import('../store/locationStore');
              const location = useLocationStore.getState();
              const result = await genreService.getGenreStations(genre, 1, 20,
                location.countryEnglish || location.country, 'votes', 'desc', location.country);
              return result.stations || [];
            }, async country => {
              const result = await stationService.getPopularStations(country, 30);
              return result.stations || [];
            }, (requestId, stations, error) => wearOSService.updateStations(stations, { requestId, error }))) break;
            if (data.type === 'genre_stations' && data.genreId) {
              await handleWatchCommand({ command: 'requestGenreStations', genreSlug: data.genreId });
            } else if (data.type === 'country_stations' && data.countryCode) {
              await handleWatchCommand({ command: 'requestCountryStations', countryName: data.countryCode });
            } else if (data.type === 'all') {
              wearOSService.updateFavorites(favorites);
              const state = usePlayerStore.getState();
              if (state.currentStation) wearOSService.updateNowPlaying(state.currentStation,
                state.playbackState === 'playing', state.nowPlaying?.title || '', state.nowPlaying?.artist || '');
              await syncCompanionCatalog('android');
            }
          } catch (e) {
            console.log('[AudioProvider] request_data parse error:', e);
          }
          break;
        case 'playStation':
          if (command.stationId) {
            let station = favorites.find(
              (s: any) => (s._id || s.id) === command.stationId
            );
            if (!station) {
              try {
                station = await stationService.getStation(command.stationId);
              } catch (e) {
                console.log('[AudioProvider] Could not fetch station:', e);
              }
            }
            if (station) {
              await playStation(station, { advertising: false });
            }
          }
          break;
        case 'requestGenreStations':
          if ((command as any).genreSlug) {
            try {
              const { useLocationStore } = await import('../store/locationStore');
              const locState = useLocationStore.getState();
              const countryEn = locState.countryEnglish || locState.country;
              const countryNative = locState.country;
              
              const result = await genreService.getGenreStations(
                (command as any).genreSlug, 1, 20, countryEn, 'votes', 'desc', countryNative
              );
              
              if (result.stations && result.stations.length > 0) {
                if (Platform.OS === 'ios') {
                  watchService.updateGenreStations(result.stations);
                } else {
                  wearOSService.updateStations(result.stations);
                }
                console.log('[AudioProvider] Sent', result.stations.length, 'genre stations to Watch');
              } else {
                if (Platform.OS === 'ios') {
                  watchService.updateGenreStations([]);
                } else {
                  wearOSService.updateStations([]);
                }
              }
            } catch (e) {
              console.log('[AudioProvider] Error fetching genre stations for Watch:', e);
              if (Platform.OS === 'ios') {
                watchService.updateGenreStations([]);
              } else {
                wearOSService.updateStations([]);
              }
            }
          }
          break;
        case 'requestCountries':
          try {
            const countriesResponse = await api.get(API_ENDPOINTS.filters.countries);
            const watchCountries = normalizeCompanionCountries(countriesResponse.data)
              .map(country => ({ ...country, flag: country.flag || countryNameToFlag(country.name) }));
            
            if (Platform.OS === 'ios') {
              watchService.updateCountries(watchCountries);
            } else {
              wearOSService.updateCountries(watchCountries);
            }
            console.log('[AudioProvider] Sent', watchCountries.length, 'countries to Watch');
          } catch (e) {
            console.log('[AudioProvider] Error fetching countries for Watch:', e);
          }
          break;
        case 'requestCountryStations':
          if ((command as any).countryName) {
            try {
              const countryName = (command as any).countryName;
              const result = await stationService.getPopularStations(countryName, 30);
              
              if (result.stations && result.stations.length > 0) {
                if (Platform.OS === 'ios') {
                  watchService.updateCountryStations(result.stations);
                } else {
                  wearOSService.updateStations(result.stations);
                }
                console.log('[AudioProvider] Sent', result.stations.length, 'country stations to Watch');
              } else {
                if (Platform.OS === 'ios') {
                  watchService.updateCountryStations([]);
                } else {
                  wearOSService.updateStations([]);
                }
              }
            } catch (e) {
              console.log('[AudioProvider] Error fetching country stations for Watch:', e);
              if (Platform.OS === 'ios') {
                watchService.updateCountryStations([]);
              } else {
                wearOSService.updateStations([]);
              }
            }
          }
          break;
      }
    };
    
    // Register listeners per platform
    let unsubscribeIOS: (() => void) | null = null;
    let unsubscribeAndroid: (() => void) | null = null;
    
    if (Platform.OS === 'ios') {
      unsubscribeIOS = watchService.addCommandListener(handleWatchCommand);
    } else if (Platform.OS === 'android') {
      unsubscribeAndroid = wearOSService.addCommandListener(handleWatchCommand);
    }
    
    return () => {
      unsubscribeIOS?.();
      unsubscribeAndroid?.();
    };
  }, [favorites, currentStation, playStation, pause, resume, togglePlayPause]);

  const value: AudioContextType = useMemo(() => ({
    playStation,
    stopPlayback,
    pause,
    resume,
    togglePlayPause,
    setVolume,
    currentStation,
    playbackState: storePlaybackState,
    streamUrl,
    isPlaying,
  }), [
    playStation,
    stopPlayback,
    pause,
    resume,
    togglePlayPause,
    setVolume,
    currentStation,
    storePlaybackState,
    streamUrl,
    isPlaying,
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export default AudioProvider;
