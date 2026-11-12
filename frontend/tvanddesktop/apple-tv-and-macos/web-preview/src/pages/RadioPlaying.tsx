import { useLocation, useSearch, Link } from "wouter";
import { resolveStationImageUrl, handleStationImageError } from "@/lib/imageUtils";
import { useQuery } from "@tanstack/react-query";
import { megaRadioApi, type Station } from "@/services/megaRadioApi";
import { useMemo, useEffect, useRef, useState } from "react";
import { useFocusManager, getFocusClasses } from "@/hooks/useFocusManager";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useCountry } from "@/contexts/CountryContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import { useSleepTimer } from "@/contexts/SleepTimerContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useIdleDetection } from "@/hooks/useIdleDetection";
import { useImageColors } from "@/hooks/useImageColors";
import { CountrySelector } from "@/components/CountrySelector";
import { CountryTrigger } from "@/components/CountryTrigger";
import { TV_LAYOUT, RADIO_PLAYER_CONTROLS, RADIO_PLAYER_RIGHT, revealTvItem, revealTvItemHorizontally } from '@/lib/tvLayout';
import { Sidebar } from "@/components/Sidebar";
import { assetPath } from "@/lib/assetPath";
import { useHelp } from "@/contexts/HelpContext";
import { isTvBackKey } from '@/lib/navigationRestore';
import { HorizontalScrollCues } from '@/components/HorizontalScrollCues';


export const RadioPlaying = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  const routeSearch = useSearch();
  const { t } = useLocalization();
  const { selectedCountry, selectedCountryCode, selectedCountryFlag, setCountry } = useCountry();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { playStation, togglePlayPause, isPlaying, isBuffering, currentStation, streamError, retryCurrentStation, clearStreamError, nowPlayingMetadata } = useGlobalPlayer();
  const { isTimerActive, remainingSeconds } = useSleepTimer();
  const { navigationState } = useNavigation();

  const { isIdle } = useIdleDetection({ idleTime: 180000 });

  const ambientImageUrl = useMemo(function() {
    if (!currentStation) return undefined;
    return resolveStationImageUrl(currentStation.favicon) || undefined;
  }, [currentStation]);
  const ambientColors = useImageColors(ambientImageUrl);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [helpFocused, setHelpFocused] = useState(false);
  const { openHelp, closeHelp, helpOpen } = useHelp();
  const helpFocusedRef = useRef(false);
  const helpOpenRef = useRef(false);
  helpFocusedRef.current = helpFocused;
  helpOpenRef.current = helpOpen;
  const setHF = (v: boolean) => { helpFocusedRef.current = v; setHelpFocused(v); };
  useEffect(() => {
    if (!isIdle || !currentStation) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [isIdle, currentStation]);

  const formatSleepTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Station history for Previous button (stores station IDs)
  const stationHistoryRef = useRef<string[]>([]);
  const isNavigatingBackRef = useRef(false);
  
  // Force update trigger for station changes
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  // Country selector state
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = useState(false);
  
  // Popular stations display count
  const [popularStationsToShow, setPopularStationsToShow] = useState(20);
  const [allPopularStations, setAllPopularStations] = useState<Station[]>([]);
  
  // Scroll refs for auto-scrolling focused cards
  const containerScrollRef = useRef<HTMLDivElement>(null);
  const similarScrollRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);
  
  // Parse station ID from URL query params, hash params, or cast localStorage
  const stationId = useMemo(() => {
    try {
      // Try to get from wouter location first (hash-based: /#/radio-playing?station=123)
      const queryStart = location.indexOf('?');
      if (queryStart !== -1) {
        const queryString = location.substring(queryStart + 1);
        const searchParams = new URLSearchParams(queryString);
        const id = searchParams.get('station') || searchParams.get('stationId');
        if (id && typeof id === 'string' && id.trim().length > 0) {
          return id.trim();
        }
      }

      // Fallback: Try window.location.search (pre-hash: /?stationId=123#/radio-playing)
      if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        const id = searchParams.get('station') || searchParams.get('stationId');
        if (id && typeof id === 'string' && id.trim().length > 0) {
          return id.trim();
        }
      }

      // Fallback: Try window.location.hash query params directly
      try {
        var fullHash = window.location.hash || '';
        var hashQueryStart = fullHash.indexOf('?');
        if (hashQueryStart !== -1) {
          var hashQuery = fullHash.substring(hashQueryStart + 1);
          var hashParams = new URLSearchParams(hashQuery);
          var hashId = hashParams.get('station') || hashParams.get('stationId');
          if (hashId && typeof hashId === 'string' && hashId.trim().length > 0) {
            return hashId.trim();
          }
        }
      } catch (e) {}

      // Fallback: Check cast_pending_station from localStorage (set by CastContext)
      try {
        var castStation = localStorage.getItem('cast_pending_station');
        if (castStation && castStation.trim().length > 0) {
          localStorage.removeItem('cast_pending_station');
          return castStation.trim();
        }
      } catch (e) {}

      // Final fallback: Use currentStation ID if available
      if (currentStation && currentStation._id) {
        return currentStation._id;
      }

      return null;
    } catch (error) {
      console.error('Error parsing station ID from URL:', error);
      return null;
    }
  }, [location, routeSearch, updateTrigger]);
  // Keep the original list origin while Next/Similar changes the playing station.
  const originRef = useRef(navigationState?.returnStationId === stationId ? navigationState : null);
  const returnToSource = () => {
    const origin = originRef.current;
    if (origin?.country) setCountry(origin.country.name, origin.country.code, origin.country.flag);
    setLocation(origin?.previousPage || '/discover-no-user', { replace: true });
  };
  
  // Track station history when station ID changes
  useEffect(() => {
    if (stationId && !isNavigatingBackRef.current) {
      const lastStation = stationHistoryRef.current[stationHistoryRef.current.length - 1];
      if (lastStation !== stationId) {
        stationHistoryRef.current.push(stationId);
      }
    }
    isNavigatingBackRef.current = false;
  }, [stationId]);

  // Fallback image - music note on pink gradient background
  const FALLBACK_IMAGE = assetPath('images/fallback-station.png');

  const getStationImage = (station: Station | null | undefined): string => {
    if (!station) return FALLBACK_IMAGE;
    return resolveStationImageUrl(station.favicon) || FALLBACK_IMAGE;
  };

  const getStationTags = (station: Station): string[] => {
    if (!station.tags) return [];
    if (Array.isArray(station.tags)) return station.tags;
    return station.tags.split(',').map(tag => tag.trim());
  };

  const hasCurrentStationData = currentStation && currentStation._id === stationId;

  const { data: stationData, error: stationError } = useQuery({
    queryKey: ['station', stationId],
    queryFn: async () => {
      if (!stationId || stationId.trim().length === 0) {
        throw new Error('Invalid station ID');
      }
      try {
        const result = await megaRadioApi.getStationById(stationId);
        if (!result || !result.station) {
          throw new Error('Station data not found');
        }
        return result;
      } catch (error) {
        console.error('Failed to fetch station details:', error);
        throw error;
      }
    },
    enabled: !!stationId && stationId.trim().length > 0 && !hasCurrentStationData,
    retry: 2,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const station = stationData?.station || (hasCurrentStationData ? currentStation : null);

  // Auto-play station from URL/cast when needed
  const autoPlayedRef = useRef<string>('');
  const castPendingRef = useRef<boolean>(false);
  
  useEffect(function() {
    try {
      var castPending = localStorage.getItem('cast_autoplay_pending');
      if (castPending) {
        castPendingRef.current = true;
        localStorage.removeItem('cast_autoplay_pending');
      }
    } catch (e) {}
  }, []);

  useEffect(function() {
    if (!station || !stationId || !station._id) return;
    if (autoPlayedRef.current === station._id) return;

    var needsPlay = false;
    
    if (!currentStation) {
      needsPlay = true;
      console.log('[RadioPlaying] Auto-play: no current station');
    } else if (currentStation._id !== station._id) {
      needsPlay = true;
      console.log('[RadioPlaying] Auto-play: different station (current:', currentStation.name, 'vs target:', station.name, ')');
    } else {
      // The route already owns this station. A later paused state is user intent,
      // not a reason to start it again (including the first pause after selection).
      autoPlayedRef.current = station._id;
    }

    if (needsPlay) {
      console.log('[RadioPlaying] Auto-playing:', station.name, 'ID:', station._id);
      autoPlayedRef.current = station._id;
      playStation(station);
    }
  }, [station, stationId, isPlaying, isBuffering]);

  // Now Playing title comes from `nowPlayingMetadata` (ICY via @radiolise
  // metadata-client WebSocket). The old `/api/stations/:id/metadata` backend
  // endpoint 404s on themegaradio.com — do NOT re-introduce it.

  // Fetch similar stations
  // CACHE: 7 days
  const { data: similarData } = useQuery({
    queryKey: ['similar-stations', stationId],
    queryFn: async () => {
      if (!stationId) return { stations: [] };
      try {
        const data = await megaRadioApi.getSimilarStations(stationId, 30);
        return { stations: (data?.stations || []).filter(s => s && s._id && s._id !== stationId) };
      } catch (error) {
        console.error('Failed to fetch similar stations:', error);
        return { stations: [] };
      }
    },
    enabled: !!stationId,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const similarStations = useMemo(() => {
    const stations = [...(similarData?.stations || [])];
    for (let i = stations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stations[i], stations[j]] = [stations[j], stations[i]];
    }
    return stations;
  }, [similarData]);

  // Fetch popular stations - filtered by user's selected country.
  // CRITICAL: backend `api.themegaradio.com/api/stations` returns an EMPTY
  // list when no `country` parameter is supplied, so we MUST pass it. Falls
  // back to global only if no country is selected yet (rare).
  // CACHE: 24 hours per country.
  const { data: popularData } = useQuery({
    queryKey: ['popular-global-stations', selectedCountryCode || 'global'],
    queryFn: async () => {
      try {
        const params: { limit: number; country?: string } = { limit: 50 };
        if (selectedCountryCode) params.country = selectedCountryCode;
        const data = await megaRadioApi.getPopularStations(params);
        return { stations: (data?.stations || []).filter(s => s && s._id) };
      } catch (error) {
        console.error('Failed to fetch popular stations:', error);
        return { stations: [] };
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Update all popular stations when data changes - shuffle once and filter current station
  useEffect(() => {
    if (popularData?.stations) {
      const filtered = popularData.stations.filter(s => s._id !== stationId);
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      setAllPopularStations(filtered);
    }
  }, [popularData, stationId]);

  const popularStations = allPopularStations.slice(0, popularStationsToShow);
  const hasMorePopular = allPopularStations.length > popularStationsToShow;
  
  // Function to load more popular stations
  const loadMorePopular = () => {
    setPopularStationsToShow(prev => prev + 50);
  };

  // Calculate totalItems: 5 (sidebar) + 1 (country) + 4 (playback) + similar stations (20) + popular stations
  const popularCount = popularStations.length;
  const baseItems = Math.max(10, 10 + Math.min(similarStations.length, 20), popularCount ? 30 + popularCount : 0);
  const totalItems = streamError ? Math.max(baseItems, 101) : baseItems;

  // Define sidebar routes (NO PROFILE - 5 items)
  const sidebarRoutes = ['/discover-no-user', '/genres', '/search', '/favorites', '/country-select', '/settings'];

  // Custom navigation logic for multi-section layout
  const customHandleNavigation = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const current = focusIndex;
    let newIndex = current;

    // Help button focus mode
    if (helpFocusedRef.current) {
      if (direction === 'UP') { setHF(false); }
      else if (direction === 'RIGHT') { setHF(false); setFocusIndex(6); }
      return;
    }

    // Sidebar section (0-5)
    if (current >= 0 && current <= 5) {
      if (direction === 'DOWN') {
        if (current < 5) newIndex = current + 1;
        else { setHF(true); return; }
      } else if (direction === 'UP') {
        newIndex = current > 0 ? current - 1 : current;
      } else if (direction === 'RIGHT') {
        newIndex = 6; // Jump to first playback button
      }
    }
    // Country selector (5) - legacy, now handled by sidebar
    else if (current === 5) {
      if (direction === 'DOWN') {
        newIndex = 6; // Jump to first playback button (previous)
      } else if (direction === 'UP') {
        newIndex = 0; // Jump to sidebar top
      } else if (direction === 'LEFT') {
        newIndex = 0; // Jump to sidebar
      }
    }
    // Playback controls (6-9: previous, play/pause, next, favorite)
    else if (current >= 6 && current <= 9) {
      const relIndex = current - 6;

      if (direction === 'LEFT') {
        if (relIndex > 0) {
          newIndex = current - 1;
        } else {
          newIndex = 0; // Jump to sidebar
        }
      } else if (direction === 'RIGHT') {
        if (relIndex < 3) {
          newIndex = current + 1;
        } else if (streamError) {
          newIndex = 100; // Jump to retry button when error is shown
        }
      } else if (direction === 'UP') {
        newIndex = 5; // Jump to country selector
      } else if (direction === 'DOWN') {
        if (streamError) {
          newIndex = 100; // Jump to retry button when error is shown
        } else if (similarStations.length > 0) {
          newIndex = 10; // First similar station
        } else if (popularCount > 0) {
          newIndex = 30;
        }
      }
    }
    // Retry button (100) - only when streamError is shown
    else if (current === 100) {
      if (direction === 'LEFT') {
        newIndex = 9; // Jump to favorite button
      } else if (direction === 'UP') {
        newIndex = 7; // Jump to play/pause
      } else if (direction === 'DOWN') {
        if (similarStations.length > 0) {
          newIndex = 10;
        } else if (popularCount > 0) {
          newIndex = 30;
        }
      }
    }
    // Similar stations (10-29) - horizontal list
    else if (current >= 10 && current <= 29) {
      const relIndex = current - 10;

      if (direction === 'LEFT') {
        if (relIndex > 0) {
          newIndex = current - 1;
        } else {
          newIndex = 0; // Jump to sidebar
        }
      } else if (direction === 'RIGHT') {
        if (relIndex < Math.min(similarStations.length, 20) - 1) {
          newIndex = current + 1;
        }
      } else if (direction === 'UP') {
        newIndex = 7; // Jump to play/pause button
      } else if (direction === 'DOWN') {
        // Move to Popular stations if available
        if (popularStations.length > 0) {
          newIndex = 30; // First popular station
        }
      }
    }
    // Popular stations (30+) - horizontal list
    else if (current >= 30) {
      const relIndex = current - 30;
      const maxPopularIndex = popularCount - 1;

      if (direction === 'LEFT') {
        if (relIndex > 0) {
          newIndex = current - 1;
        } else {
          newIndex = 0; // Jump to sidebar
        }
      } else if (direction === 'RIGHT') {
        if (relIndex < maxPopularIndex) {
          newIndex = current + 1;
        }
      } else if (direction === 'UP') {
        // Move back to Similar stations
        if (similarStations.length > 0) {
          newIndex = 10; // First similar station
        } else {
          newIndex = 7; // Jump to play/pause button
        }
      } else if (direction === 'DOWN') {
        // Stay on popular stations
      }
    }

    // Clamp to valid range
    newIndex = Math.max(0, Math.min(totalItems - 1, newIndex));
    setFocusIndex(newIndex);
  };

  // Register RETURN key handler at the TOP - works even on loading screen
  usePageKeyHandler('/radio-playing', (e) => {
    if (e.defaultPrevented) return;
    // CountrySelector owns keyboard events while its modal is open.
    if (isCountrySelectorOpen) {
      if (isTvBackKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); setIsCountrySelectorOpen(false); }
      return;
    }

    const key = (window as any).tvKey;

    // Help modal open — block all page navigation; ENTER/BACK closes popup
    if (helpOpenRef.current) {
      e.preventDefault();
      const _k = e.keyCode;
      if (_k === 13 || _k === key?.ENTER || isTvBackKey(e) || _k === key?.RETURN) { closeHelp(); }
      return;
    }
    
    // RETURN key handler ALWAYS works, even when loading
    if (isTvBackKey(e) || e.keyCode === key?.RETURN) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) returnToSource();
      return;
    }
    
    // Other key handlers only work after station loads
    switch(e.keyCode) {
      case key?.UP:
      case 38:
        e.preventDefault();
        customHandleNavigation('UP');
        break;
      case key?.DOWN:
      case 40:
        e.preventDefault();
        customHandleNavigation('DOWN');
        break;
      case key?.LEFT:
      case 37:
        e.preventDefault();
        customHandleNavigation('LEFT');
        break;
      case key?.RIGHT:
      case 39:
        e.preventDefault();
        customHandleNavigation('RIGHT');
        break;
      case key?.ENTER:
      case 13:
        e.preventDefault();
        if (helpFocusedRef.current) { openHelp(); } else { handleSelect(); }
        break;
      case key?.PAGE_DOWN:
      case 34:
        // Jump to similar stations section
        e.preventDefault();
        if (similarStations.length > 0) {
          setFocusIndex(10); // First similar station
        }
        break;
      case key?.PAGE_UP:
      case 33:
        // Jump back to playback controls
        e.preventDefault();
        setFocusIndex(7); // Play/pause button
        break;
    }
  });

  // Focus management with custom navigation
  const { focusIndex, setFocusIndex, handleSelect, isFocused } = useFocusManager({
    totalItems,
    cols: 1,
    initialIndex: 7, // Start on play/pause button
    onSelect: (index) => {
      // Sidebar navigation (0-5)
      if (index >= 0 && index <= 5) {
        const route = sidebarRoutes[index];
        if (route !== '#') {
          window.location.hash = '#' + route;
        }
      }
      // Country selector (5)
      else if (index === 5) {
        setIsCountrySelectorOpen(true);
      }
      // Previous button (6)
      else if (index === 6) {
        handlePrevious();
      }
      // Play/Pause button (7)
      else if (index === 7) {
        handlePlayPause();
      }
      // Next button (8)
      else if (index === 8) {
        handleNext();
      }
      // Favorite button (9)
      else if (index === 9) {
        if (station) {
          toggleFavorite(station);
        }
      }
      // Retry stream button (100)
      else if (index === 100) {
        retryCurrentStation();
      }
      // Similar stations (10-29)
      else if (index >= 10 && index <= 29) {
        const stationIndex = index - 10;
        const targetStation = similarStations[stationIndex];
        if (targetStation) {
          navigateToStation(targetStation);
        }
      }
      // Popular stations (30+)
      else if (index >= 30) {
        const relIndex = index - 30;
        const targetStation = popularStations[relIndex];
        if (targetStation) {
          navigateToStation(targetStation);
        }
      }
    },
    onBack: returnToSource
  });

  const revealedRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerScrollRef.current;
    const row = focusIndex >= 10 && focusIndex <= 29 ? similarScrollRef.current
      : focusIndex >= 30 && !(streamError && focusIndex === 100) ? popularScrollRef.current : null;
    if (!container || !row) { revealedRowRef.current = null; return; }
    const frame = requestAnimationFrame(() => {
      const card = row.querySelector<HTMLElement>(`[data-focus-idx="${focusIndex}"]`);
      if (!card) return;
      if (revealedRowRef.current !== row) {
        revealTvItem(container, row, 24, 24, 'smooth');
        revealedRowRef.current = row;
      }
      revealTvItemHorizontally(row, card);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusIndex, similarStations.length, popularCount, streamError]);

  // Auto-play when station loads using global player
  useEffect(() => {
    if (station) {
      if (currentStation?._id === station._id) {
        return;
      }
      playStation(station);
    }
  }, [station]);

  const handlePlayPause = () => {
    togglePlayPause();
  };

  const handlePrevious = () => {
    try {
      if (stationHistoryRef.current.length <= 1) {
        return;
      }
      
      stationHistoryRef.current.pop();
      const previousStationId = stationHistoryRef.current[stationHistoryRef.current.length - 1];
      
      if (!previousStationId || previousStationId.trim().length === 0) {
        console.warn('Invalid previous station ID');
        return;
      }
      
      isNavigatingBackRef.current = true;
      
      if (!window.location || !window.location.pathname) {
        console.error('Window location not available');
        return;
      }
      
      const newUrl = `${window.location.pathname}?station=${previousStationId}${window.location.hash}`;
      window.history.pushState({}, '', newUrl);
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to navigate to previous station:', error);
      isNavigatingBackRef.current = false;
    }
  };

  const handleNext = () => {
    try {
      if (!similarStations || similarStations.length === 0) {
        return;
      }
      
      const nextStation = similarStations[0];
      if (!nextStation || !nextStation._id || nextStation._id.trim().length === 0) {
        console.warn('Invalid next station');
        return;
      }
      
      if (!window.location || !window.location.pathname) {
        console.error('Window location not available');
        return;
      }
      
      const newUrl = `${window.location.pathname}?station=${nextStation._id}${window.location.hash}`;
      window.history.pushState({}, '', newUrl);
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to navigate to next station:', error);
    }
  };

  const navigateToStation = (targetStation: Station | null | undefined) => {
    try {
      if (!targetStation || !targetStation._id || targetStation._id.trim().length === 0) {
        console.warn('Invalid target station for navigation');
        return;
      }
      
      if (!window.location || !window.location.pathname) {
        console.error('Window location not available');
        return;
      }
      
      playStation(targetStation);
      const newUrl = `${window.location.pathname}?station=${targetStation._id}${window.location.hash}`;
      window.history.pushState({}, '', newUrl);
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to navigate to station:', error);
    }
  };

  // Show error state
  if (stationError) {
    return (
      <div className="absolute inset-0 w-[1920px] h-[1080px] bg-black flex flex-col items-center justify-center gap-8" data-tv-gap-axis="column" data-tv-gap="32">
        <p className="font-['Ubuntu',Helvetica] font-bold text-[40px] text-white">{t('failed_to_load_station') || 'Failed to load station'}</p>
        <p className="font-['Ubuntu',Helvetica] font-medium text-[24px] text-gray-400">
          {stationError instanceof Error ? stationError.message : 'Unknown error'}
        </p>
        <Link href="/discover-no-user">
          <button className="bg-[#ff4199] hover:bg-[#ff1a85] px-12 py-4 rounded-[30px] font-['Ubuntu',Helvetica] font-bold text-[24px] text-white transition-colors">
            {t('back_to_discover') || 'Back to Discover'}
          </button>
        </Link>
      </div>
    );
  }

  // Show loading state with better debugging
  if (!stationId) {
    return (
      <div className="absolute inset-0 w-[1920px] h-[1080px] bg-black flex flex-col items-center justify-center gap-8" data-tv-gap-axis="column" data-tv-gap="32">
        <p className="font-['Ubuntu',Helvetica] font-bold text-[40px] text-white">{t('no_station_selected') || 'No Station Selected'}</p>
        <p className="font-['Ubuntu',Helvetica] font-medium text-[24px] text-gray-400">
          {t('please_select_station') || 'Please select a station to play'}
        </p>
        <Link href="/discover-no-user">
          <button className="bg-[#ff4199] hover:bg-[#ff1a85] px-12 py-4 rounded-[30px] font-['Ubuntu',Helvetica] font-bold text-[24px] text-white transition-colors">
            {t('back_to_discover') || 'Back to Discover'}
          </button>
        </Link>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="absolute inset-0 w-[1920px] h-[1080px] bg-black flex flex-col items-center justify-center gap-8" data-tv-gap-axis="column" data-tv-gap="32">
        <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-[#ff4199]"></div>
        <p className="font-['Ubuntu',Helvetica] font-medium text-[32px] text-white animate-pulse">
          {t('loading_station') || 'Loading station...'}
        </p>
        <p className="font-['Ubuntu',Helvetica] font-normal text-[16px] text-gray-600 mt-4" data-tv-gap-extra="16">{t('press_return_to_go_back') || 'Press RETURN to go back'}</p>
      </div>
    );
  }

  const stationTags = getStationTags(station || undefined);
  const codec = (station?.codec && typeof station.codec === 'string') ? station.codec : 'MP3';
  const bitrate = station && station.bitrate ? `${station.bitrate}kb` : '128kb';
  const countryCode = (station?.countrycode && typeof station.countrycode === 'string') 
    ? station.countrycode 
    : (station?.countryCode && typeof station.countryCode === 'string')
      ? station.countryCode
      : 'XX';

  return (
    <div data-testid="page-radio-playing" className="absolute inset-0 w-[1920px] h-[1080px]" style={{ background: 'radial-gradient(181.15% 96.19% at 5.26% 9.31%, #0E0E0E 0%, #3F1660 29.6%, #0E0E0E 100%)' }}>

      {isIdle && currentStation && !streamError && (function() {
        var p = ambientColors.primary;
        var s = ambientColors.secondary;
        var a = ambientColors.accent;
        var pR = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',';
        var sR = 'rgba(' + s[0] + ',' + s[1] + ',' + s[2] + ',';
        var aR = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',';
        var bgDark1 = 'rgb(' + Math.round(p[0] * 0.06) + ',' + Math.round(p[1] * 0.06) + ',' + Math.round(p[2] * 0.06) + ')';
        var bgDark2 = 'rgb(' + Math.round(s[0] * 0.07) + ',' + Math.round(s[1] * 0.07) + ',' + Math.round(s[2] * 0.07) + ')';
        var bgDark3 = 'rgb(' + Math.round(a[0] * 0.05) + ',' + Math.round(a[1] * 0.05) + ',' + Math.round(a[2] * 0.05) + ')';
        var metaColor = 'rgb(' + Math.min(p[0] + 40, 255) + ',' + Math.min(p[1] + 40, 255) + ',' + Math.min(p[2] + 40, 255) + ')';
        return (
        <div className="absolute inset-0 w-[1920px] h-[1080px] overflow-hidden amb-fadein" style={{ zIndex: 100, background: 'linear-gradient(135deg, #020204 0%, ' + bgDark1 + ' 30%, ' + bgDark2 + ' 50%, ' + bgDark3 + ' 70%, #030306 100%)' }} data-testid="ambient-mode-overlay">

          <div className="absolute rounded-full amb-drift-1"
            style={{ width: '1000px', height: '1000px', background: 'radial-gradient(circle, ' + pR + '0.4) 0%, ' + pR + '0.1) 40%, transparent 70%)', top: '-300px', left: '-200px' }}
          />
          <div className="absolute rounded-full amb-drift-2"
            style={{ width: '900px', height: '900px', background: 'radial-gradient(circle, ' + sR + '0.4) 0%, ' + sR + '0.1) 40%, transparent 70%)', bottom: '-250px', right: '-150px' }}
          />
          <div className="absolute rounded-full amb-drift-3"
            style={{ width: '800px', height: '800px', background: 'radial-gradient(circle, ' + aR + '0.35) 0%, ' + aR + '0.08) 40%, transparent 70%)', top: '50%', left: '50%' }}
          />
          <div className="absolute rounded-full amb-drift-4"
            style={{ width: '700px', height: '700px', background: 'radial-gradient(circle, ' + aR + '0.3) 0%, ' + aR + '0.06) 40%, transparent 70%)', top: '-150px', right: '100px' }}
          />
          <div className="absolute rounded-full amb-drift-1"
            style={{ width: '750px', height: '750px', background: 'radial-gradient(circle, ' + sR + '0.3) 0%, ' + sR + '0.06) 40%, transparent 70%)', bottom: '-100px', left: '300px' }}
          />
          <div className="absolute rounded-full amb-drift-2"
            style={{ width: '650px', height: '650px', background: 'radial-gradient(circle, ' + pR + '0.25) 0%, ' + pR + '0.05) 40%, transparent 70%)', top: '200px', right: '-100px' }}
          />

          <div className="absolute amb-ring-1" style={{ top: '50%', left: '50%', width: '500px', height: '500px', borderRadius: '50%', border: '1.5px solid ' + pR + '0.18)' }} />
          <div className="absolute amb-ring-2" style={{ top: '50%', left: '50%', width: '640px', height: '640px', borderRadius: '50%', border: '1.5px solid ' + sR + '0.15)' }} />
          <div className="absolute amb-ring-1" style={{ top: '50%', left: '50%', width: '780px', height: '780px', borderRadius: '50%', border: '1px solid ' + aR + '0.1)' }} />

          <div className="absolute rounded-full amb-glow"
            style={{ top: '45%', left: '50%', width: '550px', height: '550px', background: 'radial-gradient(circle, ' + pR + '0.35) 0%, ' + sR + '0.12) 35%, ' + aR + '0.04) 55%, transparent 70%)', pointerEvents: 'none' }}
          />

          <div className="absolute" style={{ top: '45%', left: '50%', transform: 'translate(-50%, -50%)', width: '280px', height: '280px', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#fff' }}>
            <img
              src={getStationImage(currentStation)}
              alt={currentStation.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => handleStationImageError(e, currentStation.faviconFallback, FALLBACK_IMAGE)}
            />
          </div>

          <div className="absolute flex items-end justify-center" style={{ top: '45%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '60px', gap: '4px', pointerEvents: 'none', marginTop: '170px' }} data-tv-gap-axis="row" data-tv-gap="4">
            {[0, 0.15, 0.3, 0.1, 0.25, 0.35, 0.05, 0.2].map(function(delay, i) {
              var barColors = [p, s, a];
              var barColor = barColors[i % 3];
              return (
                <div key={i} style={{
                  width: '4px',
                  height: '40px',
                  borderRadius: '2px',
                  background: 'rgb(' + barColor[0] + ',' + barColor[1] + ',' + barColor[2] + ')',
                  opacity: 0.5,
                  transformOrigin: 'bottom',
                  animation: 'amb-eq-bar ' + (1.2 + i * 0.15) + 's ease-in-out ' + delay + 's infinite',
                }} />
              );
            })}
          </div>

          <div className="absolute" style={{ top: '66%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: '900px' }}>
            <p className="font-['Ubuntu',Helvetica] font-medium" style={{ fontSize: '34px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentStation.name}
            </p>
            {nowPlayingMetadata && (
              <p className="font-['Ubuntu',Helvetica] font-light amb-text-pulse" style={{ fontSize: '22px', color: metaColor, opacity: 0.85, marginTop: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nowPlayingMetadata}
              </p>
            )}
            {currentStation.country && (
              <p className="font-['Ubuntu',Helvetica] font-light" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.25)', marginTop: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {currentStation.country}
              </p>
            )}
          </div>

          <div className="absolute" style={{ top: '48px', left: '48px' }}>
            <div className="flex items-center" style={{ gap: '8px' }} data-tv-gap-axis="row" data-tv-gap="8">
              <img alt="" src={assetPath("images/path-8.svg")} style={{ width: '32px', height: '32px', opacity: 0.4 }} />
              <p className="font-['Ubuntu',Helvetica]" style={{ fontSize: '24px', color: 'rgba(255,255,255,0.3)' }}>
                <span style={{ fontWeight: 700 }}>mega</span>radio
              </p>
            </div>
          </div>

          <div className="absolute" style={{ top: '48px', right: '60px' }}>
            <p className="font-['Ubuntu',Helvetica]" style={{ fontSize: '64px', fontWeight: 200, color: 'rgba(255,255,255,0.2)', letterSpacing: '6px' }} data-testid="ambient-clock">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="absolute" style={{ bottom: '36px', left: '50%', transform: 'translateX(-50%)' }}>
            <p className="font-['Ubuntu',Helvetica] font-light amb-text-pulse" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px', textTransform: 'uppercase' }}>
              {t('press_any_button') || 'Press any button to dismiss'}
            </p>
          </div>
        </div>
        );
      })()}

      {/* Logo */}
      <div className="absolute h-[57px] left-[30px] top-[64px] w-[164.421px] z-50">
        <p className="absolute bottom-0 font-['Ubuntu',Helvetica] leading-normal left-[18.67%] not-italic right-0 text-[27.029px] text-white top-[46.16%] whitespace-pre-wrap">
          <span className="font-bold">mega</span>radio
        </p>
        <div className="absolute bottom-[2.84%] left-0 right-[65.2%] top-0">
          <img
            alt=""
            className="block max-w-none w-full h-full"
            src={assetPath("images/path-8.svg")}
          />
        </div>
      </div>

      {/* Country capsule and favorite frame share the same right edge. */}
      <div data-testid="player-header-actions" className="absolute top-[67px] z-50 flex items-center gap-[19px]"
        style={{ right: TV_LAYOUT.width - RADIO_PLAYER_RIGHT }} data-tv-gap-axis="row" data-tv-gap="19">
      {/* Equalizer Icon */}
      <div data-testid="player-header-equalizer" className={`relative overflow-clip rounded-[30px] w-[51px] h-[51px] flex-shrink-0 transition-colors ${isPlaying ? 'bg-[#ff4199]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
        <div className="absolute h-[25px] left-[13.75px] overflow-clip top-[13px] w-[23.75px]">
          <div className={`absolute bg-white left-0 rounded-[10px] top-0 w-[6.25px] ${isPlaying ? 'animate-equalizer-global-1' : 'h-[25px]'}`} style={{ height: isPlaying ? undefined : '25px' }} />
          <div className={`absolute bg-white left-[8.75px] rounded-[10px] top-[7.5px] w-[6.25px] ${isPlaying ? 'animate-equalizer-global-2' : 'h-[17.5px]'}`} style={{ height: isPlaying ? undefined : '17.5px' }} />
          <div className={`absolute bg-white left-[17.5px] rounded-[10px] top-[3.75px] w-[6.25px] ${isPlaying ? 'animate-equalizer-global-3' : 'h-[21.25px]'}`} style={{ height: isPlaying ? undefined : '21.25px' }} />
        </div>
      </div>

      {/* Country Selector */}
      <CountryTrigger
        selectedCountry={selectedCountry}
        selectedCountryCode={selectedCountryCode}
        onClick={() => setIsCountrySelectorOpen(true)}
        focusClasses={getFocusClasses(isFocused(5))}
      />
      </div>

      {/* Left Menu / Sidebar */}
      <Sidebar activePage="discover" isFocused={helpFocused ? () => false : isFocused} getFocusClasses={getFocusClasses} isHelpFocused={helpFocused} />

      {/* Station Logo */}
      <div className="absolute bg-white left-[236px] overflow-clip rounded-[16.692px] w-[296px] h-[296px] top-[242px]">
        <img 
          src={getStationImage(station)}
                    loading="lazy"
          alt={station?.name || 'Radio Station'}
          className="absolute inset-0 max-w-none object-cover pointer-events-none w-full h-full"
          onError={(e) => handleStationImageError(e, station?.faviconFallback, FALLBACK_IMAGE)}
        />
      </div>

      {/* Equalizer Icon (Pink) */}
      <div className="absolute h-[35px] left-[596px] overflow-clip top-[242px] w-[33.25px]">
        <div className={`absolute bg-[#ff4199] left-0 rounded-[10px] top-0 w-[8.75px] ${isPlaying ? 'animate-equalizer-global-1' : 'h-[35px]'}`} style={{ height: isPlaying ? undefined : '35px' }} />
        <div className={`absolute bg-[#ff4199] left-[12.25px] rounded-[10px] w-[8.75px] ${isPlaying ? 'animate-equalizer-global-2' : 'h-[24.5px] top-[10.5px]'}`} style={{ height: isPlaying ? undefined : '24.5px', top: isPlaying ? undefined : '10.5px' }} />
        <div className={`absolute bg-[#ff4199] left-[24.5px] rounded-[10px] w-[8.75px] ${isPlaying ? 'animate-equalizer-global-3' : 'h-[29.75px] top-[5.25px]'}`} style={{ height: isPlaying ? undefined : '29.75px', top: isPlaying ? undefined : '5.25px' }} />
      </div>

      {/* Station Name */}
      <p className="absolute font-['Ubuntu',Helvetica] font-medium leading-normal left-[596px] not-italic text-[48px] text-white top-[293px] max-w-[600px] truncate">
        {station?.name || 'Unknown Station'}
      </p>

      {/* Now Playing — ICY metadata via Radiolise WebSocket (nowPlayingMetadata).
          Falls back to the i18n placeholder ("Now Playing" / "Jetzt spielen")
          when no metadata is available yet (server has no ICY, or socket still
          connecting). */}
      <p data-testid="radio-now-playing" className="absolute font-['Ubuntu',Helvetica] font-medium leading-normal left-[596px] not-italic text-[32px] text-white top-[356.71px] max-w-[700px] truncate">
        {nowPlayingMetadata || t('now_playing') || 'Now Playing'}
      </p>

      {/* Station Info Label */}
      <p className="absolute font-['Ubuntu',Helvetica] font-medium leading-normal left-[596px] not-italic text-[24px] text-white top-[425px]">
        {t('station_info') || 'Station Info'}
      </p>

      {/* Station Info Tags */}
      <div className="absolute left-[596px] top-[476px] flex gap-[11.3px] items-center" data-tv-gap-axis="row" data-tv-gap="11.3">
        {/* Country Flag — hide entirely if country is unknown/XX (was showing brand icon as fallback) */}
        {countryCode && typeof countryCode === 'string' && countryCode.toLowerCase() !== 'xx' && (
          <div className="w-[34.783px] h-[34.783px] rounded-full overflow-hidden flex-shrink-0">
            <img
              src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
              alt={station?.country || countryCode}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide flag if CDN fails — never replace with brand icon
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Bitrate */}
        <div className="bg-[#242424] h-[40px] overflow-clip rounded-[5.217px] px-[20px] flex items-center justify-center">
          <p className="font-['Ubuntu',Helvetica] font-medium text-[24.348px] text-white">{bitrate}</p>
        </div>

        {/* Codec */}
        <div className="bg-[#242424] h-[40px] overflow-clip rounded-[5.217px] px-[20px] flex items-center justify-center">
          <p className="font-['Ubuntu',Helvetica] font-medium text-[24.348px] text-white">{codec}</p>
        </div>

        {/* Country Code */}
        <div className="bg-[#242424] h-[40px] overflow-clip rounded-[5.217px] px-[20px] flex items-center justify-center">
          <p className="font-['Ubuntu',Helvetica] font-medium text-[24.348px] text-white">{countryCode}</p>
        </div>

        {/* Genre Tags - show first 2 */}
        {stationTags.slice(0, 2).map((tag, idx) => (
          <div key={idx} className="bg-[#242424] h-[40px] overflow-clip rounded-[5.217px] px-[20px] flex items-center justify-center">
            <p className="font-['Ubuntu',Helvetica] font-medium text-[24.348px] text-white">{tag}</p>
          </div>
        ))}
      </div>

      {/* Player Controls */}
      <div data-testid="radio-player-controls" className="absolute h-[90.192px] top-[356px]"
        style={{ left: RADIO_PLAYER_CONTROLS.left, width: RADIO_PLAYER_RIGHT - RADIO_PLAYER_CONTROLS.left }}>
        {/* Previous Button */}
        <div 
          className={`absolute bg-black left-0 overflow-clip rounded-[45.096px] w-[90.192px] h-[90.192px] top-0 cursor-pointer hover:bg-gray-900 transition-all flex items-center justify-center ${
            isFocused(6) ? 'border-[4px] border-[#ff4199] animate-pulse-soft' : 'border-[4px] border-transparent'
          }`}
          style={{
            boxShadow: isFocused(6) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'none'
          }}
          onClick={handlePrevious}
          data-testid="button-previous"
        >
          <svg className="w-[54.115px] h-[54.115px]" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M34.375 16.9792L23.6042 27.75L34.375 38.5208" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16.1458 16.9792V38.5208" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Play/Pause Button */}
        <div 
          className={`absolute bg-black left-[126.27px] overflow-clip rounded-[45.096px] w-[90.192px] h-[90.192px] top-0 cursor-pointer hover:bg-gray-900 transition-all flex items-center justify-center ${
            isFocused(7) ? 'border-[4px] border-[#ff4199] animate-pulse-soft' : 'border-[4px] border-transparent'
          }`}
          style={{
            boxShadow: isFocused(7) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'none'
          }}
          onClick={handlePlayPause}
          data-testid="button-play-pause"
        >
          {isPlaying ? (
            <svg className="w-[54.115px] h-[54.115px]" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="18" y="14" width="6" height="27" rx="2" fill="white"/>
              <rect x="31" y="14" width="6" height="27" rx="2" fill="white"/>
            </svg>
          ) : (
            <svg className="w-[54.115px] h-[54.115px]" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 14L38 27.5L20 41V14Z" fill="white"/>
            </svg>
          )}
        </div>

        {/* Next Button */}
        <div 
          className={`absolute bg-black left-[252.54px] overflow-clip rounded-[45.096px] w-[90.192px] h-[90.192px] top-0 cursor-pointer hover:bg-gray-900 transition-all flex items-center justify-center ${
            isFocused(8) ? 'border-[4px] border-[#ff4199] animate-pulse-soft' : 'border-[4px] border-transparent'
          }`}
          style={{
            boxShadow: isFocused(8) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'none'
          }}
          onClick={handleNext}
          data-testid="button-next"
        >
          <svg className="w-[54.115px] h-[54.115px]" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.625 16.9792L31.3958 27.75L20.625 38.5208" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M38.8542 16.9792V38.5208" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Favorite Button */}
        <div 
          className={`absolute border-[3.608px] border-solid rounded-[72.655px] top-0 cursor-pointer transition-all flex items-center justify-center ${
            (station && station._id && isFavorite(station._id))
              ? 'bg-[#ff4199] border-[#ff4199] hover:bg-[#e0368a]' 
              : 'border-black hover:bg-[rgba(255,255,255,0.1)]'
          } ${isFocused(9) ? 'border-[#ff4199] animate-pulse-soft' : ''}`}
          style={{
            boxShadow: isFocused(9) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'none',
            left: RADIO_PLAYER_CONTROLS.favoriteOffset,
            width: RADIO_PLAYER_CONTROLS.buttonSize,
            height: RADIO_PLAYER_CONTROLS.buttonSize,
          }}
          onClick={() => {
            if (station && station._id) {
              toggleFavorite(station);
            }
          }}
          data-testid="button-favorite"
        >
          <svg className="w-[50.508px] h-[50.508px]" viewBox="0 0 51 51" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25.5 44.625C24.7396 44.625 23.9792 44.3958 23.3604 43.9375C18.9375 40.6042 14.9479 37.6771 11.9792 34.7917C7.44792 30.3479 4.25 26.2646 4.25 20.625C4.25 12.6667 10.5 6.375 18.0625 6.375C21.6042 6.375 24.9167 8.14583 27.125 11.1354C29.3333 8.14583 32.6458 6.375 36.1875 6.375C43.75 6.375 50 12.6667 50 20.625C50 26.2646 46.8021 30.3479 42.2708 34.8125C39.3021 37.6979 35.3125 40.625 30.8896 43.9583C30.2708 44.3958 29.5104 44.625 28.75 44.625H25.5Z" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Sleep Timer Indicator */}
      {isTimerActive && remainingSeconds !== null && (
        <div
          className="absolute left-[1372px] top-[460px] flex items-center gap-[8px]"
          data-testid="sleep-timer-indicator"
         data-tv-gap-axis="row" data-tv-gap="8">
          <p className="font-['Ubuntu',Helvetica] font-bold text-[24px] text-[#ff4199]">
            💤 {formatSleepTimer(remainingSeconds)}
          </p>
        </div>
      )}

      {/* Stream Error Banner */}
      {streamError && (
        <div className="absolute left-[1290px] top-[160px] w-[560px] bg-[rgba(255,65,153,0.15)] border-[2px] border-[#ff4199] rounded-[16px] p-[24px] z-20" data-testid="stream-error-banner">
          <p className="font-['Ubuntu',Helvetica] font-bold text-[24px] text-white mb-[8px]">
            {t('stream_error_title') || 'Stream Unavailable'}
          </p>
          <p className="font-['Ubuntu',Helvetica] font-light text-[18px] text-[rgba(255,255,255,0.7)] mb-[16px]">
            {t('stream_error_message') || 'This station is currently not responding. Please try again or select another station.'}
          </p>
          <div className="flex gap-[16px]" data-tv-gap-axis="row" data-tv-gap="16">
            <div
              className={`bg-[#ff4199] rounded-[12px] px-[32px] py-[12px] cursor-pointer hover:bg-[#e0368a] transition-colors ${isFocused(100) ? 'ring-2 ring-white scale-105' : ''}`}
              onClick={retryCurrentStation}
              data-testid="button-retry-stream"
            >
              <p className="font-['Ubuntu',Helvetica] font-medium text-[20px] text-white">
                {t('retry') || 'Retry'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content Area for Similar & Popular Radios */}
      <div 
        ref={containerScrollRef}
        data-testid="radio-stations-scroll-area"
        className="tv-scroll-viewport absolute left-[236px] top-[559px] w-[1610px] h-[521px] overflow-y-auto overflow-x-hidden scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="relative pb-[40px]">
          {/* Similar Radios Section */}
          <p className="font-['Ubuntu',Helvetica] font-bold leading-normal not-italic text-[32px] text-white mb-[16px]">
            {t('similar_radios') || 'Similar Radios'}
          </p>

          {/* Similar Radios Horizontal Scroll */}
          <div className="relative mb-[60px]">
          <div data-testid="radio-similar-scroll" ref={similarScrollRef} className="flex overflow-x-auto scrollbar-hide scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {similarStations.slice(0, 20).map((similarStation, index) => {
              const focusIdx = 10 + index;
              return (
              <div
                key={similarStation._id || index}
                className={`flex-shrink-0 bg-[rgba(255,255,255,0.14)] h-[264px] overflow-clip rounded-[11px] w-[200px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors duration-150 relative ${
                  isFocused(focusIdx) 
                    ? 'border-[4px] border-[#ff4199] shadow-[0_0_30px_rgba(255,65,153,0.8)]' 
                    : 'border-[4px] border-transparent'
                }`}
                style={{ 
                  marginRight: '24px',
                  boxShadow: isFocused(focusIdx) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'inset 1.1px 1.1px 12.1px 0 rgba(255, 255, 255, 0.12)' 
                }}
                data-testid={`card-similar-${similarStation._id}`}
                data-station-id={similarStation._id}
                data-focus-idx={focusIdx}
                onClick={() => navigateToStation(similarStation)}
              >
                <div className="bg-white mx-auto mt-[34px] overflow-clip rounded-[6.6px] w-[132px] h-[132px]">
                  <img
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    alt={similarStation.name}
                    src={getStationImage(similarStation)}
                    onError={(e) => handleStationImageError(e, similarStation?.faviconFallback, FALLBACK_IMAGE)}
                  />
                </div>
                <p className="font-['Ubuntu',Helvetica] font-medium text-[22px] text-center text-white leading-normal mt-[21px] truncate px-2">
                  {similarStation?.name || 'Unknown Station'}
                </p>
                <p className="font-['Ubuntu',Helvetica] font-light text-[18px] text-center text-white leading-normal mt-[6.2px] truncate px-2">
                  {getStationTags(similarStation || undefined)[0] || similarStation?.country || 'Radio'}
                </p>
              </div>
              )
            })}
          </div>

          <HorizontalScrollCues id="radio-similar" scrollRef={similarScrollRef} count={similarStations.length} onNavigate={index => setFocusIndex(10 + index)} />
          </div>

          {/* Popular Radios Section */}
          <p className="font-['Ubuntu',Helvetica] font-bold leading-normal not-italic text-[32px] text-white mb-[16px]">
            {t('popular_radios') || 'Popular Radios'}
          </p>

          {/* Popular Radios Horizontal Scroll */}
          <div className="relative">
          <div data-testid="radio-popular-scroll" ref={popularScrollRef} className="flex overflow-x-auto scrollbar-hide scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {popularStations.map((popularStation, index) => {
              const focusIdx = 30 + index; // Start after similar stations (10-29)
              return (
              <div
                key={popularStation._id || index}
                className={`flex-shrink-0 bg-[rgba(255,255,255,0.14)] h-[264px] overflow-clip rounded-[11px] w-[200px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors duration-150 relative ${
                  isFocused(focusIdx) 
                    ? 'border-[4px] border-[#ff4199] shadow-[0_0_30px_rgba(255,65,153,0.8)]' 
                    : 'border-[4px] border-transparent'
                }`}
                style={{ 
                  marginRight: '24px',
                  boxShadow: isFocused(focusIdx) ? '0 0 30px rgba(255, 65, 153, 0.8)' : 'inset 1.1px 1.1px 12.1px 0 rgba(255, 255, 255, 0.12)' 
                }}
                data-testid={`card-popular-${popularStation._id}`}
                data-station-id={popularStation._id}
                data-focus-idx={focusIdx}
                onClick={() => navigateToStation(popularStation)}
              >
                <div className="bg-white mx-auto mt-[34px] overflow-clip rounded-[6.6px] w-[132px] h-[132px]">
                  <img
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    alt={popularStation.name}
                    src={getStationImage(popularStation)}
                    onError={(e) => handleStationImageError(e, popularStation?.faviconFallback, FALLBACK_IMAGE)}
                  />
                </div>
                <p className="font-['Ubuntu',Helvetica] font-medium text-[22px] text-center text-white leading-normal mt-[21px] truncate px-2">
                  {popularStation?.name || 'Unknown Station'}
                </p>
                <p className="font-['Ubuntu',Helvetica] font-light text-[18px] text-center text-white leading-normal mt-[6.2px] truncate px-2">
                  {getStationTags(popularStation || undefined)[0] || popularStation?.country || 'Radio'}
                </p>
              </div>
              )
            })}
          </div>
          <HorizontalScrollCues id="radio-popular" scrollRef={popularScrollRef} count={popularStations.length} onNavigate={index => setFocusIndex(30 + index)} />
          </div>
        </div>
      </div>

      {/* Country Selector Modal */}
      {isCountrySelectorOpen && (
        <CountrySelector
          isOpen={isCountrySelectorOpen}
          onClose={() => setIsCountrySelectorOpen(false)}
          selectedCountry={selectedCountry}
          onSelectCountry={(country) => {
            setCountry(country.name, country.code, country.flag);
            setIsCountrySelectorOpen(false);
          }}
        />
      )}
    </div>
  );
};
