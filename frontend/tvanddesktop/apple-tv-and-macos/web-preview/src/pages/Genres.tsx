import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { megaRadioApi } from "@/services/megaRadioApi";
import { useEffect, useRef, useMemo, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { useCountry } from "@/contexts/CountryContext";
import { CountrySelector } from "@/components/CountrySelector";
import { CountryTrigger } from "@/components/CountryTrigger";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import { contentBottomInset } from '@/lib/tvLayout';
import { useLocalization } from "@/contexts/LocalizationContext";
import { useFocusManager, getFocusClasses } from "@/hooks/useFocusManager";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { Sidebar } from "@/components/Sidebar";
import { assetPath } from "@/lib/assetPath";
import { useHelp } from "@/contexts/HelpContext";
import { useNavigation } from "@/contexts/NavigationContext";

export const Genres = (): JSX.Element => {
  const { selectedCountry, selectedCountryCode, selectedCountryFlag, setCountry } = useCountry();
  const { isPlaying, currentStation } = useGlobalPlayer();
  const { t } = useLocalization();
  const [location, setLocation] = useLocation();
  const { setNavigationState, popNavigationState } = useNavigation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = useState(false);
  const [helpFocused, setHelpFocused] = useState(false);
  const { openHelp, closeHelp, helpOpen } = useHelp();
  const helpFocusedRef = useRef(false);
  const helpOpenRef = useRef(false);
  helpFocusedRef.current = helpFocused;
  helpOpenRef.current = helpOpen;
  const setHF = (v: boolean) => { helpFocusedRef.current = v; setHelpFocused(v); };

  const { data: genresData } = useQuery({
    queryKey: ['/api/genres', selectedCountryCode],
    queryFn: async () => {
      if (selectedCountryCode === 'GLOBAL') {
        const result = await megaRadioApi.getAllGenres();
        return result;
      }
      const result = await megaRadioApi.getAllGenres(selectedCountryCode);
      return result;
    },
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const allGenres = useMemo(() => {
    if (!genresData?.genres) {
      return [];
    }
    
    return genresData.genres.map(genre => ({
      name: genre.name,
      slug: genre.slug,
      stationCount: genre.stationCount || 0
    }));
  }, [genresData]);

  useEffect(() => {
    if (allGenres.length > 0) {
      const topGenres = allGenres.slice(0, 4);
      topGenres.forEach(genre => {
        const key = ['genre-stations/initial', genre.slug, selectedCountryCode];
        if (!queryClient.getQueryData(key)) {
          queryClient.prefetchQuery({
            queryKey: key,
            queryFn: () => megaRadioApi.getStationsByGenre(genre.slug, { 
              country: selectedCountryCode,
              limit: 28,
              offset: 0,
              sort: 'votes'
            }),
            staleTime: 7 * 24 * 60 * 60 * 1000,
          });
        }
      });
    }
  }, [allGenres, selectedCountryCode]);

  const popularGenres = allGenres.slice(0, 8);

  const totalItems = 6 + 1 + popularGenres.length + allGenres.length;

  const sidebarRoutes = ['/discover-no-user', '/genres', '/search', '/favorites', '/country-select', '/settings'];

  const customHandleNavigation = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const current = focusIndex;
    let newIndex = current;

    // Help button focus mode
    if (helpFocusedRef.current) {
      if (direction === 'UP') { setHF(false); }
      else if (direction === 'RIGHT') { setHF(false); setFocusIndex(6); }
      return;
    }

    if (current >= 0 && current <= 5) {
      if (direction === 'DOWN') {
        if (current < 5) newIndex = current + 1;
        else { setHF(true); return; }
      } else if (direction === 'UP') {
        newIndex = current > 0 ? current - 1 : current;
      } else if (direction === 'RIGHT') {
        newIndex = 6;
      }
    }
    else if (current === 6) {
      if (direction === 'DOWN') {
        newIndex = 7;
      } else if (direction === 'LEFT') {
        newIndex = 0;
      }
    }
    else if (current >= 7 && current <= 14) {
      const relIndex = current - 7;
      const row = Math.floor(relIndex / 4);
      const col = relIndex % 4;

      if (direction === 'LEFT') {
        if (col > 0) {
          newIndex = current - 1;
        } else {
          newIndex = 0;
        }
      } else if (direction === 'RIGHT') {
        if (col < 3 && current < 14) {
          newIndex = current + 1;
        }
      } else if (direction === 'UP') {
        if (row > 0) {
          newIndex = current - 4;
        } else {
          newIndex = 6;
        }
      } else if (direction === 'DOWN') {
        if (row < 1 && current + 4 <= 14) {
          newIndex = current + 4;
        } else {
          newIndex = 15 + col;
        }
      }
    }
    else if (current >= 15) {
      const relIndex = current - 15;
      const row = Math.floor(relIndex / 4);
      const col = relIndex % 4;
      const totalAllGenres = allGenres.length;

      if (direction === 'LEFT') {
        if (col > 0) {
          newIndex = current - 1;
        } else {
          newIndex = 0;
        }
      } else if (direction === 'RIGHT') {
        if (col < 3 && (relIndex + 1) < totalAllGenres) {
          newIndex = current + 1;
        }
      } else if (direction === 'UP') {
        if (row > 0) {
          const targetIndex = current - 4;
          if (targetIndex >= 15) {
            newIndex = targetIndex;
          }
        } else {
          newIndex = 11 + col;
        }
      } else if (direction === 'DOWN') {
        const targetRelIndex = relIndex + 4;
        const targetIndex = 15 + targetRelIndex;
        
        if (targetRelIndex < totalAllGenres) {
          newIndex = targetIndex;
        }
      }
    }

    newIndex = Math.max(0, Math.min(totalItems - 1, newIndex));
    setFocusIndex(newIndex);
  };

  const [hasNavigatedToGenre, setHasNavigatedToGenre] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    const nav = (window as any).tvSpatialNav;
    if (nav) nav.scrollEnabled = false;
    return () => { if (nav) nav.scrollEnabled = true; };
  }, []);
  
  useEffect(() => {
    if (!hasNavigatedToGenre && popularGenres.length > 0) {
      setFocusIndex(7);
      setHasNavigatedToGenre(true);
    }
  }, [popularGenres.length, hasNavigatedToGenre]);

  const { focusIndex, setFocusIndex, handleSelect, handleBack, isFocused } = useFocusManager({
    totalItems,
    cols: 1,
    initialIndex: 7,
    onSelect: (index) => {
      if (index >= 0 && index <= 5) {
        const route = sidebarRoutes[index];
        if (route !== '#') {
          setNavigationState(location, index);
          window.location.hash = '#' + route;
        }
      }
      else if (index === 6) {
        setIsCountrySelectorOpen(true);
      }
      else if (index >= 7 && index <= 14) {
        const genreIndex = index - 7;
        const genre = popularGenres[genreIndex];
        if (genre) {
          const newLocation = `/genre-list/${encodeURIComponent(genre.slug)}`;
          setLocation(newLocation);
        }
      }
      else if (index >= 15) {
        const genreIndex = index - 15;
        const genre = allGenres[genreIndex];
        if (genre) {
          const newLocation = `/genre-list/${encodeURIComponent(genre.slug)}`;
          setLocation(newLocation);
        }
      }
    },
    onBack: () => {
      setLocation('/discover-no-user');
    }
  });

  // Restore sidebar focus when returning from another sidebar page (Genres → Discover → Genres).
  useEffect(() => {
    const navState = popNavigationState();
    if (navState && navState.returnFocusIndex !== null && navState.returnFocusIndex <= 5) {
      setFocusIndex(navState.returnFocusIndex);
    }
  }, []); // run once on mount

  usePageKeyHandler('/genres', (e) => {
    if (isCountrySelectorOpen) {
      return;
    }

    // Help modal open — block all page navigation; ENTER/BACK closes popup
    if (helpOpenRef.current) {
      e.preventDefault();
      const _k = e.keyCode; const _tvk = (window as any).tvKey;
      if (_k === 13 || _k === _tvk?.ENTER || _k === 461 || _k === 10009 || _k === _tvk?.RETURN) { closeHelp(); }
      return;
    }

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
        if (helpFocusedRef.current) { openHelp(); } else { handleSelect(); }
        break;
      case key?.RETURN:
      case 461:
      case 10009:
        e.preventDefault();
        if (helpFocusedRef.current) { setHF(false); } else { handleBack(); }
        break;
    }
  });

  const CARD_HEIGHT = 139;
  const CARD_GAP = 19;
  const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP;

  const CONTENT_PADDING_TOP = 60;
  const POPULAR_TITLE_HEIGHT = 32 + 24;
  const POPULAR_ROWS = 2;
  const POPULAR_SECTION_HEIGHT = POPULAR_TITLE_HEIGHT + (POPULAR_ROWS * ROW_HEIGHT) + 40;
  const ALL_TITLE_HEIGHT = 32 + 24;
  const ALL_SECTION_START = CONTENT_PADDING_TOP + POPULAR_SECTION_HEIGHT + ALL_TITLE_HEIGHT;

  const prevRowRef = useRef<number>(-1);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (focusIndex < 7) {
      // Sidebar/header navigation must not reset the content position.
      prevRowRef.current = -1;
      return;
    }

    if (focusIndex >= 7 && focusIndex <= 14) {
      const row = Math.floor((focusIndex - 7) / 4);
      const elementTop = CONTENT_PADDING_TOP + POPULAR_TITLE_HEIGHT + (row * ROW_HEIGHT);
      const elementBottom = elementTop + CARD_HEIGHT;
      const BOTTOM_PADDING = 24;
      const viewTop = scrollContainer.scrollTop;
      const viewBottom = viewTop + scrollContainer.clientHeight - BOTTOM_PADDING;

      if (elementTop < viewTop + 20) {
        scrollContainer.scrollTop = Math.max(0, elementTop - 20);
      } else if (elementBottom > viewBottom) {
        scrollContainer.scrollTop = elementTop - scrollContainer.clientHeight + CARD_HEIGHT + BOTTOM_PADDING;
      }
      prevRowRef.current = -1;
      return;
    }

    if (focusIndex >= 15) {
      const relIndex = focusIndex - 15;
      const row = Math.floor(relIndex / 4);

      prevRowRef.current = row;

      const elementTop = ALL_SECTION_START + (row * ROW_HEIGHT);
      const elementBottom = elementTop + CARD_HEIGHT;
      const BOTTOM_PADDING = 24;
      const viewTop = scrollContainer.scrollTop;
      const viewBottom = viewTop + scrollContainer.clientHeight - BOTTOM_PADDING;

      if (elementTop < viewTop + 20) {
        scrollContainer.scrollTop = Math.max(0, elementTop - 20);
      } else if (elementBottom > viewBottom) {
        scrollContainer.scrollTop = elementTop - scrollContainer.clientHeight + CARD_HEIGHT + BOTTOM_PADDING;
      }
    }
  }, [focusIndex, currentStation]);

  return (
    <div className="absolute inset-0 w-[1920px] h-[1080px] overflow-hidden" data-testid="page-genres">
      {/* Background Image - FIXED */}
      <div className="absolute h-[1292px] left-[-10px] top-[-523px] w-[1939px]">
        <img
          alt=""
          className="absolute inset-0 max-w-none object-center object-cover pointer-events-none w-full h-full"
          src={assetPath("images/hand-crowd-disco-1.png")}
        />
      </div>

      <div className="absolute inset-0 w-[1920px] h-[1080px]" style={{ background: 'linear-gradient(180deg, #0e0e0e 0%, rgba(14,14,14,0.85) 10%, rgba(14,14,14,0.6) 18%, #0e0e0e 30%)' }} />
      <div className="absolute inset-0 w-[1920px] h-[1080px]" style={{ background: 'linear-gradient(90deg, #0e0e0e 0%, #0e0e0e 8%, rgba(14,14,14,0) 20%)' }} />

      {/* Logo - FIXED */}
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

      {/* Equalizer Icon - FIXED */}
      <div className={`absolute left-[1547px] overflow-clip rounded-[30px] w-[51px] h-[51px] top-[67px] z-50 transition-colors ${isPlaying ? 'bg-[#ff4199]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
        <div className="absolute h-[35.526px] left-[8.625px] overflow-clip top-[7.737px] w-[33.75px]">
          <div className={`absolute bg-white left-0 rounded-[10px] top-0 w-[8.882px] ${isPlaying ? 'animate-equalizer-global-1' : 'h-[35.526px]'}`} style={{ height: isPlaying ? undefined : '35.526px' }} />
          <div className={`absolute bg-white left-[12.43px] rounded-[10px] w-[8.882px] ${isPlaying ? 'animate-equalizer-global-2' : 'h-[24.868px] top-[10.66px]'}`} style={{ height: isPlaying ? undefined : '24.868px', top: isPlaying ? undefined : '10.66px' }} />
          <div className={`absolute bg-white left-[24.87px] rounded-[10px] w-[8.882px] ${isPlaying ? 'animate-equalizer-global-3' : 'h-[30.197px] top-[5.33px]'}`} style={{ height: isPlaying ? undefined : '30.197px', top: isPlaying ? undefined : '5.33px' }} />
        </div>
      </div>

      {/* Country Selector Trigger - FIXED */}
      <CountryTrigger
        selectedCountry={selectedCountry}
        selectedCountryCode={selectedCountryCode}
        onClick={() => setIsCountrySelectorOpen(true)}
        focusClasses={getFocusClasses(isFocused(6))}
        className="absolute left-[1618px] top-[67px] z-50"
      />

      {/* Country Selector Modal */}
      <CountrySelector 
        isOpen={isCountrySelectorOpen}
        onClose={() => setIsCountrySelectorOpen(false)}
        selectedCountry={selectedCountry}
        onSelectCountry={(country) => {
          setCountry(country.name, country.code, country.flag);
          setIsCountrySelectorOpen(false);
        }}
      />

      {/* Left Sidebar Menu - FIXED */}
      <Sidebar activePage="genres" isFocused={helpFocused ? () => false : isFocused} getFocusClasses={getFocusClasses} isHelpFocused={helpFocused} />

      {/* Scrollable Content Area - Only this part scrolls, edges hidden behind sidebar/header */}
      <div
        ref={scrollContainerRef}
        data-testid="genres-scroll-area"
        className="absolute left-0 w-[1920px] top-[140px] overflow-y-auto overflow-x-hidden scrollbar-hide outline-none border-none z-10"
        style={{ height: 940 - contentBottomInset(!!currentStation) }}
      >
        <div className="relative pb-[100px] pt-[60px] pl-[237px] pr-[79px]" style={{ minHeight: `${60 + 100 + (2 * ROW_HEIGHT) + 80 + (Math.ceil(allGenres.length / 4) * ROW_HEIGHT) + 200}px` }}>
          {/* Popular Genres Title */}
          <p className="font-['Ubuntu',Helvetica] font-bold leading-normal not-italic text-[32px] text-white mb-[24px] ml-[6px]">
            {t('popular_genres') || 'Popular Genres'}
          </p>

          {/* Popular Genres - Row 1 (4 cols) */}
          <div className="flex gap-[21px] mb-[19px]" data-tv-gap-axis="row" data-tv-gap="21">
            {popularGenres.slice(0, 4).map((genre, index) => {
              const focusIdx = 7 + index;
              return (
                <Link key={`pop1-${genre.slug || index}`} href={`/genre-list/${encodeURIComponent(genre.slug)}`} className="flex-1 min-w-0">
                  <div
                    data-focus-idx={focusIdx}
                    className={`bg-[rgba(255,255,255,0.14)] box-border flex flex-col items-start justify-center h-[${CARD_HEIGHT}px] px-[40px] py-[28px] rounded-[20px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors ${getFocusClasses(isFocused(focusIdx))}`}
                    data-testid={`card-genre-${genre.slug}`}
                    style={{ height: `${CARD_HEIGHT}px` }}
                    onClick={() => setLocation(`/genre-list/${encodeURIComponent(genre.slug)}`)}
                  >
                    <p className="font-['Ubuntu',Helvetica] font-medium leading-normal not-italic text-[24px] text-left text-white truncate w-full">
                      {genre.name}
                    </p>
                    <p className="font-['Ubuntu',Helvetica] leading-normal not-italic text-[22px] text-left text-white mt-1">
                      {genre.stationCount} Stations
                    </p>
                    
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Popular Genres - Row 2 (4 cols) */}
          <div className="flex gap-[21px] mb-[40px]" data-tv-gap-axis="row" data-tv-gap="21">
            {popularGenres.slice(4, 8).map((genre, index) => {
              const focusIdx = 11 + index;
              return (
                <Link key={`pop2-${genre.slug || index}`} href={`/genre-list/${encodeURIComponent(genre.slug)}`} className="flex-1 min-w-0">
                  <div
                    data-focus-idx={focusIdx}
                    className={`bg-[rgba(255,255,255,0.14)] box-border flex flex-col items-start justify-center px-[40px] py-[28px] rounded-[20px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors ${getFocusClasses(isFocused(focusIdx))}`}
                    data-testid={`card-genre-${genre.slug}`}
                    style={{ height: `${CARD_HEIGHT}px` }}
                    onClick={() => setLocation(`/genre-list/${encodeURIComponent(genre.slug)}`)}
                  >
                    <p className="font-['Ubuntu',Helvetica] font-medium leading-normal not-italic text-[24px] text-left text-white truncate w-full">
                      {genre.name}
                    </p>
                    <p className="font-['Ubuntu',Helvetica] leading-normal not-italic text-[22px] text-left text-white mt-1">
                      {genre.stationCount} Stations
                    </p>
                    
                  </div>
                </Link>
              );
            })}
          </div>

          {/* All Section Title */}
          <p className="font-['Ubuntu',Helvetica] font-bold leading-normal not-italic text-[32px] text-white mb-[24px] ml-[6px]">
            All
          </p>

          {/* All Genres - Dynamic Grid (4 cols) using flexbox rows */}
          {Array.from({ length: Math.ceil(allGenres.length / 4) }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-[21px] mb-[19px]" data-tv-gap-axis="row" data-tv-gap="21">
              {allGenres.slice(rowIdx * 4, rowIdx * 4 + 4).map((genre, colIdx) => {
                const focusIdx = 15 + (rowIdx * 4) + colIdx;
                return (
                  <Link key={`all-${rowIdx}-${genre.slug || colIdx}`} href={`/genre-list/${encodeURIComponent(genre.slug)}`} className="flex-1 min-w-0">
                    <div
                      data-focus-idx={focusIdx}
                      className={`bg-[rgba(255,255,255,0.14)] box-border flex flex-col items-start justify-center px-[30px] py-[28px] rounded-[20px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors relative ${getFocusClasses(isFocused(focusIdx))}`}
                      data-testid={`card-genre-all-${genre.slug}`}
                      style={{ height: `${CARD_HEIGHT}px` }}
                      onClick={() => setLocation(`/genre-list/${encodeURIComponent(genre.slug)}`)}
                    >
                      <p className="font-['Ubuntu',Helvetica] font-medium leading-normal not-italic text-[24px] text-left text-white truncate w-full">
                        {genre.name}
                      </p>
                      <p className="font-['Ubuntu',Helvetica] leading-normal not-italic text-[22px] text-left text-white mt-1">
                        {genre.stationCount} Stations
                      </p>
                      
                    </div>
                  </Link>
                );
              })}
              {/* Fill empty cells in last row to maintain consistent widths */}
              {rowIdx === Math.ceil(allGenres.length / 4) - 1 && allGenres.length % 4 !== 0 &&
                Array.from({ length: 4 - (allGenres.length % 4) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex-1" />
                ))
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
