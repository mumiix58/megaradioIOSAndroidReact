import { reportTvEvent } from '@/lib/tvObservability';
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useNowPlayingMetadata } from '@/hooks/useNowPlayingMetadata';
import { Station, megaRadioApi } from "@/services/megaRadioApi";
import { recentlyPlayedService } from "@/services/recentlyPlayedService";
import { recommendationService } from "@/services/recommendationService";
import { trackStationPlay, trackError } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { detectPlatform } from '@/lib/platform';
import { parseStationPlaylist, browserStreamUrl, streamResolveEndpoint, resolvedStreamResponse, isBrowserAutoplayBlock } from '@/lib/streamRouting';

interface GlobalPlayerContextType {
  currentStation: Station | null;
  isPlaying: boolean;
  isBuffering: boolean;
  nowPlayingMetadata: string | null;
  streamError: string | null;
  playStation: (station: Station) => void;
  pauseStation: () => void;
  resumeStation: () => void;
  stopStation: () => void;
  togglePlayPause: () => void;
  clearStreamError: () => void;
  retryCurrentStation: () => void;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | undefined>(undefined);

function getProxiedUrl(url: string): string {
  return browserStreamUrl(url);
}

async function resolveStreamUrl(url: string): Promise<{ resolvedUrl: string; isPlaylist: boolean; isHLS: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(streamResolveEndpoint(url), { signal: controller.signal });
    if (!response.ok) {
      return { resolvedUrl: url, isPlaylist: false, isHLS: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    const result = resolvedStreamResponse(data, url);
    return { ...result, resolvedUrl: result.isPlaylist ? await resolvePlaylistOnTV(result.resolvedUrl, true) : result.resolvedUrl };

  } catch (err: any) {
    console.warn('[RESOLVE] Request failed; using original stream');
    return { resolvedUrl: url, isPlaylist: false, isHLS: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Packaged-TV playlist resolver. Samsung `avplay` and webOS HTML5 audio CANNOT
// parse `.pls` / `.m3u` playlist *files* — they need a direct stream URL. On the
// browser build the public stream resolver handles this (the historical
// Emergent preview has a separate FastAPI helper). Native file:// TV shells
// retain their direct network path, so playlist stations (e.g. Süper FM `...SUPER_FMAAC.pls`, Best FM
// `.../listen.pls`) silently failed. Here we fetch the playlist text directly
// (Tizen WRT allows cross-origin reads via `<access origin="*">` + network
// privilege; CSP `connect-src http: https:`) and extract the first stream URL.
async function resolvePlaylistOnTV(url: string, preview = false): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const requestUrl = preview ? browserStreamUrl(url, true) : url;
    const res = await fetch(requestUrl, { method: 'GET', signal: controller.signal });
    if (!res.ok) return url;
    const text = await res.text();
    return parseStationPlaylist(text, preview ? url : res.url || url);
  } catch (err: any) {
    console.warn('[RESOLVE-TV] Playlist request failed; using original stream');
  } finally {
    clearTimeout(timer);
  }
  return url;
}

export function GlobalPlayerProvider({ children }: { children: ReactNode }) {
  var { isAuthenticated, token } = useAuth();
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [nowPlayingMetadata, setNowPlayingMetadata] = useNowPlayingMetadata(currentStation, isPlaying);
  const [streamError, setStreamError] = useState<string | null>(null);
  const audioPlayerRef = useRef<any>(null);
  const metadataIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenLockActiveRef = useRef(false);
  
  // Error recovery state
  const retryCountRef = useRef(0);
  const retryExhaustedRef = useRef(false);
  const maxRetries = 3;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentStationRef = useRef<Station | null>(null);
  const playGenerationRef = useRef(0);
  const manuallyPausedRef = useRef(false);
  const lastStartedStationIdRef = useRef<string | null>(null);

  // Initialize TV audio player once
  useEffect(() => {
    let playerInstance: any = null;
    let telemetryPlaying = false;
    
    if (typeof (window as any).TVAudioPlayer !== 'undefined' && !audioPlayerRef.current) {
      playerInstance = new (window as any).TVAudioPlayer('global-audio-container');
      audioPlayerRef.current = playerInstance;
      
      playerInstance.onPlay = () => {
        if (!currentStationRef.current || manuallyPausedRef.current) return;
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
        if (!telemetryPlaying) reportTvEvent('playback_start','none',{module:'audio'});
        telemetryPlaying = true;
        console.log('[✅ EVENT] onPlay - Stream playing successfully');
        setIsPlaying(true);
        setIsBuffering(false);
        setStreamError(null);
        retryCountRef.current = 0;
        retryExhaustedRef.current = false;
      };
      
      playerInstance.onPause = () => {
        if (telemetryPlaying) reportTvEvent('playback_pause','none',{module:'audio'});
        telemetryPlaying = false;
        console.log('[⏸️ EVENT] onPause');
        setIsPlaying(false);
      };
      
      playerInstance.onStop = () => {
        telemetryPlaying = false;
        console.log('[⏹️ EVENT] onStop');
        setIsPlaying(false);
      };
      
      playerInstance.onBuffering = () => {
        console.log('[⏳ EVENT] onBuffering - Loading stream data...');
        setIsBuffering(true);
      };
      
      playerInstance.onReady = () => {
        console.log('[✅ EVENT] onReady - Stream ready');
        setIsBuffering(false);
      };
      
      playerInstance.onError = (error: any) => {
        if (!currentStationRef.current || manuallyPausedRef.current || retryExhaustedRef.current) return;
        telemetryPlaying = false;
        if (isBrowserAutoplayBlock(error)) {
          // Browser policy needs a user gesture; it is not a failed radio stream.
          manuallyPausedRef.current = true;
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
          setIsPlaying(false);
          setIsBuffering(false);
          setStreamError(null);
          return;
        }
        // Native engines can report the same failed attempt more than once.
        // Keep its first backoff deadline and diagnostic instead of postponing it.
        if (retryTimeoutRef.current !== null) return;
        lastStartedStationIdRef.current = null;
        const errorCode = error?.code || error?.target?.error?.code || 'N/A';
        reportTvEvent('playback_error', ({1:'media_aborted',2:'media_network',3:'media_decode',4:'media_unsupported'} as Record<string,string>)[String(errorCode)] || 'playback_failed', {module:'audio'});
        
        console.error('[🔴 ERROR] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[🔴 ERROR] Media code:', [1,2,3,4].includes(Number(errorCode)) ? Number(errorCode) : 0);
        console.error('[🔴 ERROR] Retry count:', retryCountRef.current, '/', maxRetries);
        
        setIsBuffering(false);
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        
        const currentStationToRetry = currentStationRef.current;
        if (currentStationToRetry && retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          console.log(`[🔄 RETRY] Will retry in ${delay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`);
          
          const retryTimer = setTimeout(async () => {
            // A cleared/rescheduled callback may already be queued by the engine.
            if (retryTimeoutRef.current !== retryTimer) return;
            retryTimeoutRef.current = null;
            if (currentStationRef.current !== currentStationToRetry || manuallyPausedRef.current || retryExhaustedRef.current) return;
            retryCountRef.current++;
            
            if (audioPlayerRef.current && currentStationToRetry) {
              let rawUrl: string;
              
              if (retryCountRef.current === 2 && currentStationToRetry.url_resolved && currentStationToRetry.url !== currentStationToRetry.url_resolved) {
                rawUrl = currentStationToRetry.url;
                console.log(`[🔄 RETRY] Trying original url instead of url_resolved`);
              } else {
                rawUrl = currentStationToRetry.url_resolved || currentStationToRetry.url;
              }

              if (retryCountRef.current >= 2 && detectPlatform() === 'web') {
                const proxyUrl = browserStreamUrl(rawUrl, true);
                console.log(`[🔄 RETRY] Force-proxying on retry ${retryCountRef.current}`);
                audioPlayerRef.current.play(proxyUrl);
              } else {
                const playUrl = getProxiedUrl(rawUrl);
                audioPlayerRef.current.play(playUrl);
              }
              console.log(`[🔄 RETRY] Retrying: ${currentStationToRetry.name}`);
            }
          }, delay);
          retryTimeoutRef.current = retryTimer;
        } else if (retryCountRef.current >= maxRetries) {
          console.error('[🔴 FAILED] Max retries reached');
          retryExhaustedRef.current = true;
          setStreamError('This station is currently unavailable');
          setIsPlaying(false);
        }
      };

      playerInstance.onMetadata = (metadata: string) => {
        setNowPlayingMetadata(metadata);
      };
    }

    return () => {
      playGenerationRef.current++;
      currentStationRef.current = null;
      // Clear retry timeout on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Clear event handlers to prevent memory leaks
      if (playerInstance) {
        playerInstance.onPlay = null;
        playerInstance.onPause = null;
        playerInstance.onStop = null;
        playerInstance.onBuffering = null;
        playerInstance.onReady = null;
        playerInstance.onError = null;
        playerInstance.onMetadata = null;
        
        if (typeof playerInstance.stop === 'function') {
          try {
            playerInstance.stop();
          } catch (err) {
            // Silently ignore cleanup errors
          }
        }
      }
      
      audioPlayerRef.current = null;
    };
  }, []);

  // Now-playing lifecycle is isolated in useNowPlayingMetadata: resolved ICY + mobile REST fallback.

  // Screensaver prevention - Samsung TV certification requirement
  useEffect(() => {
    const hasTizen = typeof (window as any).tizen !== 'undefined';
    let wakeLock: any = null;
    let releaseHandler: (() => void) | null = null;
    
    if (!hasTizen) {
      // Use Web Wake Lock API for non-Samsung platforms (if supported)
      if ('wakeLock' in navigator && isPlaying) {
        const requestWakeLock = async () => {
          try {
            wakeLock = await (navigator as any).wakeLock.request('screen');
            
            releaseHandler = () => {
            };
            wakeLock.addEventListener('release', releaseHandler);
          } catch (err) {
          }
        };
        
        requestWakeLock();
        
        return () => {
          if (wakeLock) {
            if (releaseHandler) {
              wakeLock.removeEventListener('release', releaseHandler);
            }
            wakeLock.release().catch(() => {});
            wakeLock = null;
          }
        };
      }
      return;
    }
    
    // Samsung Tizen implementation
    if (isPlaying && !screenLockActiveRef.current) {
      try {
        (window as any).tizen.power.request('SCREEN', 'SCREEN_NORMAL');
        screenLockActiveRef.current = true;
      } catch (err) {
        trackError('Failed to request screen lock', 'screensaverPrevention');
      }
    } else if (!isPlaying && screenLockActiveRef.current) {
      try {
        (window as any).tizen.power.release('SCREEN');
        screenLockActiveRef.current = false;
      } catch (err) {
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (screenLockActiveRef.current && hasTizen) {
        try {
          (window as any).tizen.power.release('SCREEN');
          screenLockActiveRef.current = false;
        } catch (err) {
        }
      }
    };
  }, [isPlaying]);

  const playStation = (station: Station) => {
    if (!audioPlayerRef.current) {
      console.error('[🔴 PLAY] Audio player not initialized');
      trackError('Audio player not initialized', 'playStation');
      return;
    }

    const rawUrl = station.url_resolved || station.url;
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      setStreamError('This station has no stream URL');
      return;
    }
    const generation = ++playGenerationRef.current;
    manuallyPausedRef.current = false;
    lastStartedStationIdRef.current = null;
    
    console.log('[🎵 PLAY] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[🎵 PLAY] Station:', station.name);
    console.log('[🎵 PLAY] ID:', station._id);
    console.log('[🎵 PLAY] Stream selected');
    console.log('[🎵 PLAY] URL type:', rawUrl?.startsWith('https') ? 'HTTPS' : rawUrl?.startsWith('http') ? 'HTTP' : 'OTHER');
    console.log('[🎵 PLAY] Codec:', station.codec || 'unknown');
    console.log('[🎵 PLAY] Bitrate:', station.bitrate || 'unknown');
    
    try {
      if (audioPlayerRef.current && typeof audioPlayerRef.current.stop === 'function') {
        audioPlayerRef.current.stop();
      }
    } catch (err) {
      // ignore cleanup errors
    }
    
    setCurrentStation(station);
    currentStationRef.current = station;
    setIsBuffering(true);
    setStreamError(null);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    retryExhaustedRef.current = false;

    const startPlayback = (finalUrl: string) => {
      const playUrl = getProxiedUrl(finalUrl);
      console.log('[🎵 PLAY] Playback source ready');
      
      setTimeout(() => {
        if (audioPlayerRef.current && !manuallyPausedRef.current && generation === playGenerationRef.current && currentStationRef.current?._id === station._id) {
          lastStartedStationIdRef.current = station._id;
          audioPlayerRef.current.play(playUrl);
        }
      }, 50);
    };

    const urlLower = rawUrl.toLowerCase();
    const needsResolve = urlLower.endsWith('.m3u') || urlLower.endsWith('.pls') || 
      urlLower.includes('.m3u?') || urlLower.includes('.pls?');

    if (needsResolve && detectPlatform() !== 'web') {
      // All packaged shells lack the preview backend (including Electron/Android TV).
      console.log('[🎵 PLAY] TV playlist detected — resolving client-side...');
      resolvePlaylistOnTV(rawUrl).then(direct => {
        if (generation !== playGenerationRef.current) return;
        console.log('[🎵 PLAY] TV playlist resolved');
        startPlayback(direct);
      }).catch(() => {
        if (generation === playGenerationRef.current) {
          startPlayback(rawUrl);
        }
      });
    } else if (needsResolve) {
      console.log('[🎵 PLAY] URL looks like a playlist, resolving first...');
      resolveStreamUrl(rawUrl).then(result => {
        if (generation !== playGenerationRef.current) return;
        if (result.error) {
          console.warn('[🎵 PLAY] Resolver warning; using resolved stream');
        }
        console.log('[🎵 PLAY] Stream resolved');
        startPlayback(result.resolvedUrl);
      }).catch(() => {
        if (generation === playGenerationRef.current) {
          startPlayback(rawUrl);
        }
      });
    } else {
      startPlayback(rawUrl);
    }

    trackStationPlay(station.name, station.country || '', station.tags?.[0] || '');

    try {
      localStorage.setItem("lastPlayedStation", JSON.stringify(station));
    } catch (err) {
      trackError('Failed to save station to localStorage', 'playStation');
    }

    recentlyPlayedService.addStation(station, token);
    recommendationService.trackListen(station);
  };

  const pauseStation = () => {
    manuallyPausedRef.current = true;
    playGenerationRef.current++;
    setIsBuffering(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
  };

  const resumeStation = () => {
    manuallyPausedRef.current = false;
    if (currentStation && lastStartedStationIdRef.current !== currentStation._id) {
      void playStation(currentStation);
      return;
    }
    if (audioPlayerRef.current && currentStation) {
      // Use resume() function instead of play() to continue from pause
      if (typeof audioPlayerRef.current.resume === 'function') {
        audioPlayerRef.current.resume();
      } else {
        const rawUrl = currentStation.url_resolved || currentStation.url;
        const playUrl = getProxiedUrl(rawUrl);
        audioPlayerRef.current.play(playUrl);
      }
    }
  };

  const stopStation = () => {
    manuallyPausedRef.current = true;
    lastStartedStationIdRef.current = null;
    playGenerationRef.current++;
    currentStationRef.current = null;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsBuffering(false);
    setCurrentStation(null);
    setIsPlaying(false);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      setCurrentStation(null);
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseStation();
    } else {
      resumeStation();
    }
  };

  const retryCurrentStation = () => {
    if (currentStation) {
      setStreamError(null);
      retryCountRef.current = 0;
      playStation(currentStation);
    }
  };

  const clearStreamError = () => {
    setStreamError(null);
  };

  useEffect(function() {
    if (isAuthenticated && token) {
      recentlyPlayedService.syncFromApi(token);
    }
  }, [isAuthenticated, token]);

  // Expose player controls to window for TV remote media buttons
  useEffect(() => {
    (window as any).globalPlayer = {
      togglePlayPause,
      pause: pauseStation,
      resume: resumeStation,
      stop: stopStation,
      isPlaying,
      currentStation,
    };
    
    // Cleanup: remove globalPlayer from window on unmount
    return () => {
      if ((window as any).globalPlayer) {
        delete (window as any).globalPlayer;
      }
    };
  }, [isPlaying, currentStation]);

  return (
    <GlobalPlayerContext.Provider
      value={{
        currentStation,
        isPlaying,
        isBuffering,
        nowPlayingMetadata,
        streamError,
        playStation,
        pauseStation,
        resumeStation,
        stopStation,
        togglePlayPause,
        clearStreamError,
        retryCurrentStation,
      }}
    >
      {/* Hidden audio container */}
      <div id="global-audio-container" style={{ display: 'none' }} />
      {children}
    </GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error("useGlobalPlayer must be used within a GlobalPlayerProvider");
  }
  return context;
}
