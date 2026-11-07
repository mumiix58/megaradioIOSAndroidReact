import { Link, useLocation } from "wouter";
import { resolveStationImageUrl, handleStationImageError } from "@/lib/imageUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { megaRadioApi, type Station } from "@/services/megaRadioApi";
import { cacheService } from "@/services/cacheService";
import { AppLayout } from "@/components/AppLayout";
import { useCountry } from "@/contexts/CountryContext";
import { useRef, useEffect, useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { useFocusManager, getFocusClasses } from "@/hooks/useFocusManager";
import { useNavigation, useSavedNavigationData, usePageSnapshot } from "@/contexts/NavigationContext";
import { restoreNavigationPosition } from '@/lib/navigationRestore';
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import { contentBottomInset } from '@/lib/tvLayout';
import { assetPath } from "@/lib/assetPath";

export const GenreList = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  const { selectedCountryCode } = useCountry();
  const { t } = useLocalization();
  const { setNavigationState, popNavigationState } = useNavigation();
  const saved = useSavedNavigationData<{ country: string; displayedStations: Station[]; currentOffset: number; hasMore: boolean }>(location);
  const { playStation, currentStation } = useGlobalPlayer();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const pathParts = location.split('/');
  
  let genreSlug = pathParts[2] || 'pop'; // /genre-list/SLUG
  
  const genreName = genreSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const [displayedStations, setDisplayedStations] = useState<Station[]>(saved?.displayedStations || []);
  const [currentOffset, setCurrentOffset] = useState(saved?.currentOffset || 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(saved?.hasMore ?? true);
  const restoredDataKey = useRef(saved ? `${genreSlug}/${saved.country}` : undefined);
  usePageSnapshot(location, () => ({ country: selectedCountryCode, displayedStations, currentOffset, hasMore }));
  const STATIONS_PER_LOAD = 28;

  const cachedGenreStations = (() => {
    const cached = cacheService.getGenreStations(genreSlug, selectedCountryCode);
    if (cached.data && cached.data.length > 0) {
      return { stations: cached.data, pagination: {}, genre: { slug: genreSlug, name: genreName } };
    }
    return undefined;
  })();

  const { data: stationsData, isLoading } = useQuery({
    queryKey: ['genre-stations/initial', genreSlug, selectedCountryCode],
    queryFn: async () => {
      const result = await megaRadioApi.getStationsByGenre(genreSlug, { 
        country: selectedCountryCode,
        limit: STATIONS_PER_LOAD,
        offset: 0,
        sort: 'votes'
      });
      
      return result;
    },
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    initialData: cachedGenreStations,
  });
  
  // Initialize when initial data loads - PAGINATION
  // Note: No need for refetch useEffect - queryKey changes trigger automatic refetch
  useEffect(() => {
    // Guard stationsData?.stations before rendering
    if (restoredDataKey.current === `${genreSlug}/${selectedCountryCode}`) return;
    restoredDataKey.current = undefined;
    if (stationsData && stationsData.stations && Array.isArray(stationsData.stations)) {
      if (stationsData.stations.length > 0) {
        const stations = stationsData.stations;
        
        setDisplayedStations(stations);
        setCurrentOffset(STATIONS_PER_LOAD); // Next fetch will use offset=28
        
        // If we got less than requested, there's no more to load
        const hasMoreStations = stations.length >= STATIONS_PER_LOAD;
        setHasMore(hasMoreStations);
      } else {
        // No stations found for this genre/country combo
        setDisplayedStations([]);
        setHasMore(false);
        setCurrentOffset(0);
      }
    } else {
      // Null or undefined stations data
      setDisplayedStations([]);
      setHasMore(false);
      setCurrentOffset(0);
    }
  }, [stationsData?.stations, genreSlug, selectedCountryCode]);

  useEffect(() => {
    if (stationsData?.stations && stationsData.stations.length > 0) {
      cacheService.setGenreStations(genreSlug, selectedCountryCode, stationsData.stations);
      prefetchGenreNextPage(genreSlug, selectedCountryCode, STATIONS_PER_LOAD);
    }
  }, [stationsData, genreSlug, selectedCountryCode]);

  const fetchGenrePage = (slug: string, country: string, offset: number, limit: number) => {
    return megaRadioApi.getStationsByGenre(slug, { country, limit, offset, sort: 'votes' });
  };

  const prefetchGenreNextPage = (slug: string, country: string, nextOffset: number) => {
    queryClient.prefetchQuery({
      queryKey: ['/api/genre-stations/page', slug, country, nextOffset, STATIONS_PER_LOAD],
      queryFn: () => fetchGenrePage(slug, country, nextOffset, STATIONS_PER_LOAD),
      staleTime: 7 * 24 * 60 * 60 * 1000,
    });
  };

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    
    try {
      const queryKey = ['/api/genre-stations/page', genreSlug, selectedCountryCode, currentOffset, STATIONS_PER_LOAD];
      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchGenrePage(genreSlug, selectedCountryCode, currentOffset, STATIONS_PER_LOAD),
        staleTime: 7 * 24 * 60 * 60 * 1000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
      });
      
      if (!result || !result.stations) {
        return;
      }

      const newStations = result.stations || [];
      
      if (Array.isArray(newStations) && newStations.length > 0) {
        setDisplayedStations(prev => {
          if (!Array.isArray(prev)) {
            return newStations;
          }
          const existingIds = new Set(prev.map(s => s._id));
          const uniqueNewStations = newStations.filter(s => !existingIds.has(s._id));
          return [...prev, ...uniqueNewStations];
        });
        const nextOffset = currentOffset + STATIONS_PER_LOAD;
        setCurrentOffset(nextOffset);
        
        const hasMoreStations = newStations.length >= STATIONS_PER_LOAD;
        setHasMore(hasMoreStations);

        if (hasMoreStations) {
          prefetchGenreNextPage(genreSlug, selectedCountryCode, nextOffset);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more stations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let retired = false;
    const handleScroll = () => {
      if (retired || !scrollContainerRef.current) return;
      clearTimeout(loadMoreTimer.current);
      loadMoreTimer.current = setTimeout(() => {
        if (retired || !scrollContainerRef.current) return;
        try {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
          if (distanceFromBottom < 600 && hasMore && !isLoadingMore) {
            loadMore();
          }
        } catch (_) {}
      }, 200);
    };

    scrollContainer.addEventListener('scroll', handleScroll, false);
    return () => {
      retired = true;
      scrollContainer.removeEventListener('scroll', handleScroll, false);
      clearTimeout(loadMoreTimer.current);
    };
  }, [hasMore, isLoadingMore, currentOffset]);

  // Fallback image - music note on pink gradient background
  const FALLBACK_IMAGE = assetPath('images/fallback-station.png');

  // Helper function to get station image
  const getStationImage = (station: Station) => {
    return resolveStationImageUrl(station.favicon) || FALLBACK_IMAGE;
  };

  // Helper function to get station tags as array
  const getStationTags = (station: Station): string[] => {
    if (!station.tags) return [];
    if (Array.isArray(station.tags)) return station.tags;
    return station.tags.split(',').map(tag => tag.trim());
  };

  // Helper function to get first category/tag
  const getStationCategory = (station: Station): string => {
    const tags = getStationTags(station);
    if (tags.length > 0) return tags[0];
    return station.country || 'Radio';
  };

  // Focus management with sidebar: 5 sidebar + stations
  // Sidebar: 0-4, Stations: 5+
  const sidebarRoutes = ['/discover-no-user', '/genres', '/search', '/favorites', '/country-select', '/settings'];
  const stationsStart = 6;
  const totalItems = 6 + displayedStations.length;

  // Custom navigation for sidebar + content
  const customHandleNavigation = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const current = focusIndex;
    let newIndex = current;

    // Sidebar (0-4)
    if (current >= 0 && current <= 5) {
      if (direction === 'DOWN') {
        newIndex = current < 5 ? current + 1 : current;
      } else if (direction === 'UP') {
        newIndex = current > 0 ? current - 1 : current;
      } else if (direction === 'RIGHT') {
        newIndex = stationsStart; // Jump to first station
      }
    }
    // Stations grid (5+) - 7 columns
    else if (current >= stationsStart) {
      const relIndex = current - stationsStart;
      const row = Math.floor(relIndex / 7);
      const col = relIndex % 7;
      const totalStations = displayedStations.length;

      if (direction === 'LEFT') {
        // Only move left if not in first column
        if (col > 0) {
          newIndex = current - 1;
        } else {
          // First column - jump to Genres in sidebar (index 1)
          newIndex = 1;
        }
      } else if (direction === 'RIGHT') {
        // Only move right if not in last column AND next station exists
        if (col < 6 && (relIndex + 1) < totalStations) {
          newIndex = current + 1;
        }
        // Otherwise stay at current position
      } else if (direction === 'UP') {
        // Only move up if not in first row
        if (row > 0) {
          const targetIndex = current - 7;
          // Make sure target station exists
          if (targetIndex >= stationsStart) {
            newIndex = targetIndex;
          }
        } else {
          // First row - jump to Genres in sidebar (index 1)
          newIndex = 1;
        }
      } else if (direction === 'DOWN') {
        // Calculate the target position in the next row (same column)
        const targetRelIndex = relIndex + 7;
        const targetIndex = stationsStart + targetRelIndex;
        
        // Only move down if the target station actually exists
        if (targetRelIndex < totalStations) {
          newIndex = targetIndex;
        }
        // Target doesn't exist - stay at current position
      }
    }

    // Ensure newIndex is within valid bounds
    newIndex = Math.max(0, Math.min(totalItems - 1, newIndex));
    setFocusIndex(newIndex);
  };

  const { focusIndex, setFocusIndex, handleSelect, handleBack, isFocused } = useFocusManager({
    totalItems,
    cols: 1,
    initialIndex: 0, // Start on sidebar, will jump to first station when loaded
    onSelect: (index) => {
      // Sidebar (0-5)
      if (index >= 0 && index <= 5) {
        const route = sidebarRoutes[index];
        window.location.hash = '#' + route;
      }
      // Stations (5+)
      else if (index >= stationsStart) {
        const stationIndex = index - stationsStart;
        const station = displayedStations[stationIndex];
        if (station) {
          setNavigationState(location, index, station._id, 'genre');
          playStation(station);
          setLocation(`/radio-playing?station=${station._id}`);
        }
      }
    },
    onBack: () => setLocation('/genres')
  });

  useEffect(() => {
    const nav = (window as any).tvSpatialNav;
    if (nav) {
      nav.scrollEnabled = false;
    }
    return () => {
      if (nav) {
        nav.scrollEnabled = true;
      }
    };
  }, []);

  // Jump to first station when stations load OR restore focus when returning.
  // IMPORTANT: only run this auto-focus logic ONCE — after the first batch of
  // stations arrives. Otherwise re-running on every length change steals focus
  // back from the sidebar whenever the user moves LEFT to sidebar then more
  // stations load in the background.
  const initialFocusSetRef = useRef(false);
  useEffect(() => {
    if (initialFocusSetRef.current) return;
    if (displayedStations.length === 0) return; // wait for first batch
    initialFocusSetRef.current = true;

    const navState = popNavigationState(location);
    if (navState && navState.returnFocusIndex !== null) {
      const found = displayedStations.findIndex(s => s._id === navState.returnStationId);
      setFocusIndex(found >= 0 ? stationsStart + found : Math.min(navState.returnFocusIndex, totalItems - 1));
      restoreNavigationPosition(navState);
    } else if (focusIndex < stationsStart) {
      setFocusIndex(stationsStart);
    }
  }, [displayedStations.length]);

  const scrollRAF = useRef<number>(0);

  useEffect(() => {
    if (focusIndex < stationsStart || !scrollContainerRef.current) return;

    cancelAnimationFrame(scrollRAF.current);
    scrollRAF.current = requestAnimationFrame(() => {
      try {
        const container = scrollContainerRef.current;
        if (!container) return;

        const stationIndex = focusIndex - stationsStart;
        const focusedEl = container.querySelector(`[data-station-index="${stationIndex}"]`) as HTMLElement;
        if (!focusedEl) return;

        const TOP_PADDING = 20;
        // 220px bottom: Global Player bar (top:925, h:155 of 1080 canvas) over-
        // laps focused cards at the bottom of the viewport. Matching the value
        // used in DiscoverNoUser.tsx ensures the focused card always sits a
        // visible gap above the player bar.
        const BOTTOM_PADDING = 24; // The viewport itself now stops above the player.

        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight - BOTTOM_PADDING;

        let elementTop = 0;
        let el: HTMLElement | null = focusedEl;
        while (el && el !== container) {
          elementTop += el.offsetTop;
          el = el.offsetParent as HTMLElement;
          if (!el || el.nodeType !== 1) break;
        }

        const elementBottom = elementTop + focusedEl.offsetHeight;
        const isAboveView = elementTop < viewTop + TOP_PADDING;
        const isBelowView = elementBottom > viewBottom;

        if (isAboveView) {
          container.scrollTop = elementTop - TOP_PADDING;
        } else if (isBelowView) {
          container.scrollTop = elementBottom - container.clientHeight + BOTTOM_PADDING;
        }
      } catch (_) {}
    });

    return () => cancelAnimationFrame(scrollRAF.current);
  }, [focusIndex, stationsStart, currentStation]);

  // TRUE INFINITE SCROLL trigger - Focus-based (when within last 28 items / 4 rows)
  // Load MORE stations BEFORE user reaches the end for seamless experience
  useEffect(() => {
    try {
      // Only trigger for station items section
      if (focusIndex >= stationsStart) {
        const stationIndex = focusIndex - stationsStart;
        const distanceFromEnd = displayedStations.length - stationIndex;
        
        // If user is within last 28 items (4 rows × 7 columns), load more
        if (distanceFromEnd <= 28 && hasMore && !isLoadingMore) {
          loadMore();
        }
      }
    } catch (error) {
      console.error('Error in infinite scroll trigger:', error);
    }
  }, [focusIndex, stationsStart, displayedStations.length, hasMore, isLoadingMore]);

  // Register page-specific key handler with custom navigation
  usePageKeyHandler('/genre-list', (e) => {
    const key = (window as any).tvKey;
    
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
        handleSelect();
        break;
      case key?.RETURN:
      case 461:
      case 10009:
        e.preventDefault();
        handleBack();
        break;
    }
  });

  return (
    <AppLayout currentPage="genres" scrollContainerRef={scrollContainerRef} isFocused={isFocused}>
      <div ref={scrollContainerRef} className="relative w-[1920px] overflow-y-auto overflow-x-hidden"
        style={{ height: 1080 - contentBottomInset(!!currentStation) }} data-testid="page-genre-list">
        {/* Background Image */}
        <div className="absolute h-[1292px] left-[-10px] top-[-523px] w-[1939px]">
          <img
            alt=""
            className="absolute inset-0 max-w-none object-cover pointer-events-none w-full h-full"
            src={assetPath("images/hand-crowd-disco-1.png")}
          />
        </div>

        {/* Gradient Overlay */}
        {/* Gradient overlay — match Discover's full-coverage dark fade
            (was 18.33%→15.185% which left the hero image too visible and
            broke visual continuity with Discover). Discover uses
            0.88%→48.611% to dark, copying that here. */}
        <div className="absolute bg-gradient-to-b from-[0.88%] from-[rgba(14,14,14,0)] h-[1080px] left-0 to-[#0e0e0e] to-[48.611%] top-0 w-[1920px] z-0" />

        {/* Genre Title */}
        <p className="absolute font-['Ubuntu',Helvetica] font-bold leading-normal left-[236px] not-italic text-[32px] text-white top-[242px]">
          {genreName} {t('radios') || 'Radios'}
        </p>

        {/* Skeleton Loading Cards - only shown during active loading, not on error/empty */}
        {isLoading && !stationsData && displayedStations.length === 0 && Array.from({ length: 14 }).map((_, index) => {
          const row = Math.floor(index / 7);
          const col = index % 7;
          const positions = [74, 304, 534, 764, 994, 1224, 1454];
          return (
            <div
              key={`skeleton-${index}`}
              className="absolute bg-[rgba(255,255,255,0.08)] h-[264px] rounded-[11px] w-[200px] animate-pulse"
              style={{ left: `${positions[col]}px`, top: `${316 + row * 294}px` }}
            >
              <div className="absolute bg-[rgba(255,255,255,0.1)] left-[34px] rounded-[6.6px] w-[132px] h-[132px] top-[34px]" />
              <div className="absolute bg-[rgba(255,255,255,0.1)] left-[16px] right-[16px] h-[14px] rounded top-[186px]" />
              <div className="absolute bg-[rgba(255,255,255,0.06)] left-[16px] w-[80px] h-[12px] rounded top-[210px]" />
            </div>
          );
        })}

        {/* Radio Station Cards - Dynamic Grid */}
        {Array.isArray(displayedStations) && displayedStations.map((station, index) => {
          // Validate station object exists and has required properties
          if (!station || !station._id || !station.name) {
            return null;
          }

          const row = Math.floor(index / 7);
          const col = index % 7;
          const leftPosition = 236 + (col * 230); // 236px start, 230px between columns
          const topPosition = 316 + (row * 294); // 316px start, 294px between rows
          
          return (
            <Link key={station._id || index} href={`/radio-playing?station=${station._id}`}
              onClick={() => { setNavigationState(location, stationsStart + index, station._id, 'genre'); playStation(station); }}>
              <div 
                className={`absolute bg-[rgba(255,255,255,0.14)] h-[264px] overflow-clip rounded-[11px] w-[200px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors ${getFocusClasses(isFocused(index + stationsStart))}`}
                style={{ left: `${leftPosition}px`, top: `${topPosition}px` }}
                data-testid={`station-card-${index}`}
                data-station-index={index}
                data-station-id={station._id} data-nav-section="genre"
                data-focused={isFocused(stationsStart + index)}
              >
                <div className="absolute bg-white left-[34px] overflow-clip rounded-[6.6px] w-[132px] h-[132px] top-[34px]">
                  <img
                    alt={station.name}
                    className="absolute inset-0 max-w-none object-cover pointer-events-none w-full h-full"
                    src={getStationImage(station)}
                    loading="lazy"
                    onError={(e) => handleStationImageError(e, station.faviconFallback, FALLBACK_IMAGE)}
                  />
                </div>
                <p className="absolute font-['Ubuntu',Helvetica] font-medium leading-normal left-[100px] not-italic text-[22px] text-center text-white top-[187px] translate-x-[-50%] truncate px-2 max-w-[180px]">
                  {station.name}
                </p>
                <p className="absolute font-['Ubuntu',Helvetica] font-light leading-normal left-[100px] not-italic text-[18px] text-center text-white top-[218.2px] translate-x-[-50%] truncate px-2 max-w-[180px]">
                  {getStationCategory(station)}
                </p>
                <div className="absolute inset-0 pointer-events-none shadow-[inset_1.1px_1.1px_12.1px_0px_rgba(255,255,255,0.12)]" />
              </div>
            </Link>
          );
        })}

        {/* Loading Spinner for lazy loading */}
        {isLoadingMore && displayedStations.length > 0 && (
          <div 
            className="absolute left-[236px] w-[1580px] h-[80px] flex items-center justify-center"
            style={{ top: `${316 + (Math.ceil(displayedStations.length / 7) * 294)}px` }}
          >
            <div className="animate-spin rounded-full h-10 w-10 border-t-3 border-b-3 border-[#ff4199]"></div>
          </div>
        )}

        {/* No Stations Found */}
        {!isLoading && (!Array.isArray(displayedStations) || displayedStations.length === 0) && (
          <div className="absolute left-[236px] top-[450px] w-[1580px] h-[200px] flex flex-col items-center justify-center">
            <p className="font-['Ubuntu',Helvetica] font-bold text-[32px] text-white mb-4">
              {t('no_stations_found') || 'No Stations Found'}
            </p>
            <p className="font-['Ubuntu',Helvetica] font-light text-[24px] text-[#c8c8c8]">
              {t('try_different_genre') || 'Try a different genre or country'}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
