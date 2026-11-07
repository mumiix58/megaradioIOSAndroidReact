import { useLocation } from "wouter";
import { resolveStationImageUrl, handleStationImageError } from "@/lib/imageUtils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { megaRadioApi, type Station } from "@/services/megaRadioApi";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import { recentlyPlayedService } from "@/services/recentlyPlayedService";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Sidebar } from "@/components/Sidebar";
import { assetPath } from "@/lib/assetPath";
import { useHelp } from "@/contexts/HelpContext";
import { useNativeKeyboard } from "@/hooks/useNativeKeyboard";

interface KeyboardLayout {
  id: string;
  label: string;
  flag: string;
  rows: string[][];
}

const KEYBOARD_LAYOUTS: KeyboardLayout[] = [
  {
    id: 'en', label: 'English', flag: '🇬🇧',
    rows: [['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['O','P','Q','R','S','T','U'],['V','W','X','Y','Z','-',"'"],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'tr', label: 'Türkçe', flag: '🇹🇷',
    rows: [['A','B','C','Ç','D','E','F'],['G','Ğ','H','I','İ','J','K'],['L','M','N','O','Ö','P','R'],['S','Ş','T','U','Ü','V','Y'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'ar', label: 'العربية', flag: '🇸🇦',
    rows: [['ا','ب','ت','ث','ج','ح','خ'],['د','ذ','ر','ز','س','ش','ص'],['ض','ط','ظ','ع','غ','ف','ق'],['ك','ل','م','ن','ه','و','ي'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'ru', label: 'Русский', flag: '🇷🇺',
    rows: [['А','Б','В','Г','Д','Е','Ж'],['З','И','К','Л','М','Н','О'],['П','Р','С','Т','У','Ф','Х'],['Ц','Ч','Ш','Щ','Э','Ю','Я'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'de', label: 'Deutsch', flag: '🇩🇪',
    rows: [['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['O','P','Q','R','S','T','U'],['V','W','X','Y','Z','Ä','Ö'],['Ü','ß','SPACE','DELETE','CLEAR']],
  },
  {
    id: 'fr', label: 'Français', flag: '🇫🇷',
    rows: [['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['O','P','Q','R','S','T','U'],['V','W','X','Y','Z','É','È'],['Ê','Ç','SPACE','DELETE','CLEAR']],
  },
  {
    id: 'es', label: 'Español', flag: '🇪🇸',
    rows: [['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['Ñ','O','P','Q','R','S','T'],['U','V','W','X','Y','Z','-'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'ja', label: '日本語', flag: '🇯🇵',
    rows: [['あ','い','う','え','お','か','き'],['く','け','こ','さ','し','す','せ'],['そ','た','ち','つ','て','と','な'],['に','ぬ','ね','の','は','ひ','ふ'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'zh', label: '中文', flag: '🇨🇳',
    rows: [['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['O','P','Q','R','S','T','U'],['V','W','X','Y','Z','-',"'"],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'ko', label: '한국어', flag: '🇰🇷',
    rows: [['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ'],['ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'],['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ'],['ㅠ','ㅡ','ㅣ','ㄲ','ㄸ','ㅃ','ㅆ'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'el', label: 'Ελληνικά', flag: '🇬🇷',
    rows: [['Α','Β','Γ','Δ','Ε','Ζ','Η'],['Θ','Ι','Κ','Λ','Μ','Ν','Ξ'],['Ο','Π','Ρ','Σ','Τ','Υ','Φ'],['Χ','Ψ','Ω','-',"'",' ',' '],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'hi', label: 'हिन्दी', flag: '🇮🇳',
    rows: [['अ','आ','इ','ई','उ','ऊ','ए'],['क','ख','ग','घ','च','छ','ज'],['ट','ठ','ड','ढ','त','थ','द'],['प','फ','ब','म','र','ल','स'],['SPACE','DELETE','CLEAR']],
  },
  {
    id: 'th', label: 'ไทย', flag: '🇹🇭',
    rows: [['ก','ข','ค','ง','จ','ช','ซ'],['ด','ต','ถ','ท','น','บ','ป'],['พ','ม','ย','ร','ล','ว','ส'],['ห','อ','ะ','า','ิ','ี','ุ'],['SPACE','DELETE','CLEAR']],
  },
];

const getKbFlagUrl = (id: string): string => {
  const map: Record<string, string> = {
    en: 'gb', tr: 'tr', ar: 'sa', ru: 'ru', de: 'de', fr: 'fr',
    es: 'es', ja: 'jp', zh: 'cn', ko: 'kr', el: 'gr', hi: 'in', th: 'th',
  };
  return `https://flagcdn.com/w40/${map[id] || 'gb'}.png`;
};

import { useNavigation, usePageSnapshot, useSavedNavigationData } from '@/contexts/NavigationContext';
import { restoreNavigationPosition } from '@/lib/navigationRestore';

type FocusZone = 'sidebar' | 'keyboard' | 'list' | 'langButton' | 'langDropdown' | 'recent';

export const Search = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  const { setNavigationState, popNavigationState, navigationState } = useNavigation();
  const saved = useSavedNavigationData<{ query: string; debounced: string; recent: Station[]; keyboardRow: number; keyboardCol: number; layout: number }>(location);
  const { playStation } = useGlobalPlayer();
  const { t } = useLocalization();

  const [searchQuery, setSearchQuery] = useState(() => {
    if (saved) return saved.query;
    // Android TV Assistant passes the spoken query in the hash route.
    const query = typeof window !== 'undefined' ? window.location.hash.split('?')[1] : '';
    return new URLSearchParams(query || window.location.search).get('q') || '';
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(saved?.debounced || '');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [recentlyPlayedStations, setRecentlyPlayedStations] = useState<Station[]>(saved?.recent || []);

  const { openHelp, closeHelp, helpOpen } = useHelp();
  const [helpFocused, setHelpFocused] = useState(false);
  const helpFocusedRef = useRef(false);
  const helpOpenRef = useRef(false);
  helpFocusedRef.current = helpFocused;
  helpOpenRef.current = helpOpen;
  const setHF = (v: boolean) => { helpFocusedRef.current = v; setHelpFocused(v); };
  const [focusZone, setFocusZone] = useState<FocusZone>('keyboard');
  const [sidebarIndex, setSidebarIndex] = useState(2);
  const [keyboardRow, setKeyboardRow] = useState(saved?.keyboardRow || 0);
  const [keyboardCol, setKeyboardCol] = useState(saved?.keyboardCol || 0);
  const [listFocusIndex, setListFocusIndex] = useState(0);
  const [recentFocusIndex, setRecentFocusIndex] = useState(0);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(() => {
    if (saved) return saved.layout;
    const preferredKeyboard = localStorage.getItem('preferredKeyboard');
    if (preferredKeyboard) {
      const idx = KEYBOARD_LAYOUTS.findIndex(k => k.id === preferredKeyboard);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);

  const lastKeyboardPos = useRef({ row: 0, col: 0 });
  const lastListPos = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dropdownScrollRef = useRef<HTMLDivElement>(null);

  const activeLayout = KEYBOARD_LAYOUTS[activeLayoutIndex];
  const KEYBOARD_ROWS = activeLayout.rows;

  const sidebarRoutes = ['/discover-no-user', '/genres', '/search', '/favorites', '/country-select', '/settings'];

  const isFocused = (idx: number) => focusZone === 'sidebar' && sidebarIndex === idx;
  const getFocusClasses = (_focused: boolean) => '';

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (searchQuery.length < 3) {
      setDebouncedSearchQuery("");
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['/api/stations/search', debouncedSearchQuery],
    queryFn: () => megaRadioApi.searchStations({ q: debouncedSearchQuery, limit: 50 }),
    enabled: debouncedSearchQuery.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const { data: popularStationsData } = useQuery({
    queryKey: ['/api/stations/popular', { limit: 6 }],
    queryFn: () => megaRadioApi.getPopularStations({ limit: 6 }),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const allSearchResults = useMemo(() => {
    if (debouncedSearchQuery.length === 0) return [];
    const results = searchData?.results || [];
    const query = debouncedSearchQuery.toLowerCase();
    return [...results].sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aExact = aName === query ? 1 : 0;
      const bExact = bName === query ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aStarts = aName.startsWith(query) ? 1 : 0;
      const bStarts = bName.startsWith(query) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return (b.votes || 0) - (a.votes || 0);
    });
  }, [searchData, debouncedSearchQuery]);
  const visibleSearchResults = allSearchResults.slice(0, 8);

  useEffect(() => {
    try {
      if (saved) return;
      const recent = recentlyPlayedService.getStations();
      if (Array.isArray(recent)) setRecentlyPlayedStations(recent);
      else setRecentlyPlayedStations([]);
    } catch { setRecentlyPlayedStations([]); }
  }, []);

  const recentStations = recentlyPlayedStations.length > 0
    ? recentlyPlayedStations
    : (popularStationsData?.stations || []);

  usePageSnapshot(location, () => ({ query: searchQuery, debounced: debouncedSearchQuery,
    recent: recentStations, keyboardRow, keyboardCol, layout: activeLayoutIndex }));
  const openStation = (station: Station, index: number, section: 'search' | 'recent') => {
    setNavigationState(location, index, station._id, section);
    playStation(station);
    setLocation(`/radio-playing?station=${encodeURIComponent(station._id)}`);
  };
  const returnRestored = useRef(false);
  useEffect(() => {
    if (returnRestored.current || navigationState?.previousPage !== location) return;
    const recent = navigationState.returnSection === 'recent';
    const list = recent ? recentStations : visibleSearchResults;
    if (!list.length) return;
    const state = popNavigationState(location);
    if (!state) return;
    returnRestored.current = true;
    const found = list.findIndex(s => s._id === state.returnStationId);
    const index = found >= 0 ? found : Math.min(state.returnFocusIndex, list.length - 1);
    setFocusZone(recent ? 'recent' : 'list');
    if (recent) setRecentFocusIndex(index);
    else { setListFocusIndex(index); lastListPos.current = index; }
    restoreNavigationPosition(state);
  }, [navigationState, location, recentStations, visibleSearchResults]);

  const FALLBACK_IMAGE = assetPath('images/fallback-station.png');

  const getStationImage = (station: Station) => {
    return resolveStationImageUrl(station.favicon) || FALLBACK_IMAGE;
  };

  const getStationTags = (station: Station): string[] => {
    if (!station.tags) return [];
    if (Array.isArray(station.tags)) return station.tags;
    return station.tags.split(',').map(tag => tag.trim());
  };

  const getStationCategory = (station: Station): string => {
    const tags = getStationTags(station);
    if (tags.length > 0) return tags[0];
    return station.country || 'Radio';
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return <span className="text-[#a5a5a5]">{text}</span>;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return <span className="text-[#a5a5a5]">{text}</span>;
    return (
      <>
        <span className="text-[#a5a5a5]">{text.substring(0, index)}</span>
        <span className="text-white">{text.substring(index, index + query.length)}</span>
        <span className="text-[#a5a5a5]">{text.substring(index + query.length)}</span>
      </>
    );
  };

  const getKeyLabel = (key: string) => {
    if (key === 'SPACE') return 'SPACE';
    if (key === 'DELETE') return '⌫';
    if (key === 'CLEAR') return 'CLEAR';
    return key;
  };

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'SPACE') {
      setSearchQuery(prev => prev + ' ');
    } else if (key === 'DELETE') {
      setSearchQuery(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setSearchQuery('');
    } else if (key.trim() === '') {
      return;
    } else {
      setSearchQuery(prev => prev + key.toLowerCase());
    }
  }, []);

  // Physical keyboard support (Desktop / Electron) — typing anywhere on the
  // Search page updates the query without needing a mouse click first. Only
  // alphanumerics so the D-pad engine keeps owning arrows / enter.
  useNativeKeyboard({
    enabled: !helpOpenRef.current && !dropdownOpen && focusZone !== 'langDropdown',
    alphanumericOnly: true,
    onChar: (c) => setSearchQuery(prev => prev + c),
    onBackspace: () => setSearchQuery(prev => prev.slice(0, -1)),
  });

  useEffect(() => {
    if (visibleSearchResults.length > 0 && listFocusIndex >= visibleSearchResults.length) {
      setListFocusIndex(0);
    }
  }, [visibleSearchResults.length, listFocusIndex]);

  const firstQueryReset = useRef(true);
  useEffect(() => {
    if (firstQueryReset.current) { firstQueryReset.current = false; if (saved) return; }
    if (scrollContainerRef.current && searchQuery) {
      scrollContainerRef.current.scrollTop = 0;
      setListFocusIndex(0);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (focusZone !== 'list' || !scrollContainerRef.current || visibleSearchResults.length === 0) return;

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const focusedElement = container.children[listFocusIndex] as HTMLElement | undefined;
      if (!focusedElement) return;

      // 220px bottom-padding so focused items in Search results never sit
      // under the bottom player bar (top:925 / h:155 on the 1080 canvas).
      // Top padding stays generous (20) since the header is small here.
      const TOP_PADDING = 20;
      const BOTTOM_PADDING = 220;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight - BOTTOM_PADDING;

      let elementTop = 0;
      let el: HTMLElement | null = focusedElement;
      while (el && el !== container) {
        elementTop += el.offsetTop;
        el = el.offsetParent as HTMLElement;
      }
      const elementBottom = elementTop + focusedElement.offsetHeight;

      if (elementTop < viewTop + TOP_PADDING) {
        container.scrollTop = Math.max(0, elementTop - TOP_PADDING);
      } else if (elementBottom > viewBottom) {
        container.scrollTop = elementBottom - container.clientHeight + BOTTOM_PADDING;
      }
    });
  }, [listFocusIndex, visibleSearchResults.length, focusZone]);

  useEffect(() => {
    if (focusZone === 'langDropdown' && dropdownScrollRef.current) {
      const container = dropdownScrollRef.current;
      const item = container.children[dropdownIndex] as HTMLElement | undefined;
      if (item) {
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        if (itemTop < container.scrollTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > container.scrollTop + container.clientHeight) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [dropdownIndex, focusZone]);

  usePageKeyHandler('/search', (e) => {
    const key = (window as any).tvKey;
    const keyCode = e.keyCode;
    const isUp = keyCode === 38 || keyCode === key?.UP;
    const isDown = keyCode === 40 || keyCode === key?.DOWN;
    const isLeft = keyCode === 37 || keyCode === key?.LEFT;
    const isRight = keyCode === 39 || keyCode === key?.RIGHT;
    const isEnter = keyCode === 13 || keyCode === key?.ENTER;
    const isBack = keyCode === 461 || keyCode === 10009 || keyCode === key?.RETURN;

    // Help modal open — block all page navigation; ENTER/BACK closes popup
    if (helpOpenRef.current) {
      e.preventDefault();
      if (isEnter || isBack) { closeHelp(); }
      return;
    }

    if (isBack) {
      e.preventDefault();
      if (helpFocusedRef.current) { setHF(false); return; }
      if (dropdownOpen) {
        setDropdownOpen(false);
        setFocusZone('langButton');
        return;
      }
      window.location.hash = '#/discover-no-user';
      return;
    }

    if (focusZone === 'langDropdown') {
      if (isUp) {
        e.preventDefault();
        setDropdownIndex(prev => Math.max(0, prev - 1));
      } else if (isDown) {
        e.preventDefault();
        setDropdownIndex(prev => Math.min(KEYBOARD_LAYOUTS.length - 1, prev + 1));
      } else if (isEnter) {
        e.preventDefault();
        setActiveLayoutIndex(dropdownIndex);
        setDropdownOpen(false);
        setFocusZone('langButton');
        setKeyboardRow(0);
        setKeyboardCol(0);
      } else if (isLeft) {
        e.preventDefault();
        setDropdownOpen(false);
        setFocusZone('langButton');
      }
      return;
    }

    if (focusZone === 'sidebar') {
      // Help button focus mode
      if (helpFocusedRef.current) {
        if (isUp) { e.preventDefault(); setHF(false); }
        else if (isEnter) { e.preventDefault(); openHelp(); }
        else if (isRight) { e.preventDefault(); setHF(false); setFocusZone('keyboard'); setKeyboardRow(lastKeyboardPos.current.row); setKeyboardCol(lastKeyboardPos.current.col); }
        return;
      }
      if (isUp) {
        e.preventDefault();
        setSidebarIndex(prev => Math.max(0, prev - 1));
      } else if (isDown) {
        e.preventDefault();
        if (sidebarIndex < 5) { setSidebarIndex(prev => prev + 1); } else { setHF(true); }
      } else if (isRight) {
        e.preventDefault();
        setFocusZone('keyboard');
        setKeyboardRow(lastKeyboardPos.current.row);
        setKeyboardCol(lastKeyboardPos.current.col);
      } else if (isEnter) {
        e.preventDefault();
        const route = sidebarRoutes[sidebarIndex];
        if (route) {
          window.location.hash = '#' + route;
        }
      }
      return;
    }

    if (focusZone === 'keyboard') {
      const currentRow = KEYBOARD_ROWS[keyboardRow];
      if (isUp) {
        e.preventDefault();
        if (keyboardRow > 0) {
          const newRow = keyboardRow - 1;
          const newRowLen = KEYBOARD_ROWS[newRow].length;
          setKeyboardRow(newRow);
          setKeyboardCol(prev => Math.min(prev, newRowLen - 1));
        }
      } else if (isDown) {
        e.preventDefault();
        if (keyboardRow < KEYBOARD_ROWS.length - 1) {
          const newRow = keyboardRow + 1;
          const newRowLen = KEYBOARD_ROWS[newRow].length;
          setKeyboardRow(newRow);
          setKeyboardCol(prev => Math.min(prev, newRowLen - 1));
        } else {
          setFocusZone('langButton');
        }
      } else if (isLeft) {
        e.preventDefault();
        if (keyboardCol > 0) {
          setKeyboardCol(prev => prev - 1);
        } else {
          lastKeyboardPos.current = { row: keyboardRow, col: keyboardCol };
          if (visibleSearchResults.length > 0) {
            setFocusZone('list');
            setListFocusIndex(lastListPos.current);
          } else {
            setFocusZone('sidebar');
          }
        }
      } else if (isRight) {
        e.preventDefault();
        if (keyboardCol < currentRow.length - 1) {
          setKeyboardCol(prev => prev + 1);
        }
      } else if (isEnter) {
        e.preventDefault();
        const pressedKey = currentRow[keyboardCol];
        handleKeyPress(pressedKey);
      }
      return;
    }

    if (focusZone === 'list') {
      if (isUp) {
        e.preventDefault();
        setListFocusIndex(prev => Math.max(0, prev - 1));
      } else if (isDown) {
        e.preventDefault();
        setListFocusIndex(prev => Math.min(visibleSearchResults.length - 1, prev + 1));
      } else if (isRight) {
        e.preventDefault();
        lastListPos.current = listFocusIndex;
        setFocusZone('keyboard');
        setKeyboardRow(lastKeyboardPos.current.row);
        setKeyboardCol(lastKeyboardPos.current.col);
      } else if (isLeft) {
        e.preventDefault();
        setFocusZone('sidebar');
      } else if (isEnter) {
        e.preventDefault();
        const station = visibleSearchResults[listFocusIndex];
        if (station) {
          openStation(station, listFocusIndex, 'search');
        }
      }
      return;
    }

    if (focusZone === 'langButton') {
      if (isUp) {
        e.preventDefault();
        setFocusZone('keyboard');
        setKeyboardRow(KEYBOARD_ROWS.length - 1);
        setKeyboardCol(0);
      } else if (isDown) {
        e.preventDefault();
        if (recentStations.length > 0) {
          setFocusZone('recent');
          setRecentFocusIndex(0);
        }
      } else if (isEnter) {
        e.preventDefault();
        setDropdownOpen(true);
        setDropdownIndex(activeLayoutIndex);
        setFocusZone('langDropdown');
      } else if (isLeft) {
        e.preventDefault();
        if (visibleSearchResults.length > 0) {
          setFocusZone('list');
          setListFocusIndex(lastListPos.current);
        } else {
          setFocusZone('sidebar');
        }
      }
      return;
    }

    if (focusZone === 'recent') {
      const maxRecent = Math.min(recentStations.length, 8);
      const row = Math.floor(recentFocusIndex / 4);
      const col = recentFocusIndex % 4;
      if (isUp) {
        e.preventDefault();
        if (row > 0) {
          setRecentFocusIndex(recentFocusIndex - 4);
        } else {
          setFocusZone('langButton');
        }
      } else if (isDown) {
        e.preventDefault();
        const nextIdx = recentFocusIndex + 4;
        if (nextIdx < maxRecent) {
          setRecentFocusIndex(nextIdx);
        }
      } else if (isLeft) {
        e.preventDefault();
        if (col > 0) {
          setRecentFocusIndex(recentFocusIndex - 1);
        } else {
          setFocusZone('sidebar');
        }
      } else if (isRight) {
        e.preventDefault();
        if (col < 3 && recentFocusIndex + 1 < maxRecent) {
          setRecentFocusIndex(recentFocusIndex + 1);
        }
      } else if (isEnter) {
        e.preventDefault();
        const station = recentStations[recentFocusIndex];
        if (station) {
          openStation(station, recentFocusIndex, 'recent');
        }
      }
      return;
    }
  });

  return (
    <div className="relative w-[1920px] h-[1080px] overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]" data-testid="page-search">
      <div className="absolute left-[30px] top-[64px] w-[164.421px] h-[57px]">
        <p className="absolute bottom-0 left-[18.67%] right-0 top-[46.16%] font-['Ubuntu',Helvetica] text-[27.029px] text-white leading-normal whitespace-pre-wrap">
          <span className="font-bold">mega</span>radio
        </p>
        <img
          className="absolute left-0 bottom-[2.84%] w-[34.8%] h-[97.16%]"
          alt="Path"
          src={assetPath("images/path-8.svg")}
        />
      </div>

      <Sidebar activePage="search" isFocused={helpFocused ? () => false : isFocused} getFocusClasses={getFocusClasses} isHelpFocused={helpFocused} />

      <p className="absolute font-['Ubuntu',Helvetica] font-bold leading-normal left-[246px] not-italic text-[32px] text-white top-[58px]">
        {t('search') || 'Search'}
      </p>

      {/* LEFT SIDE: Search bar + Results list */}
      <div
        className="absolute left-[246px] top-[110px] w-[660px] h-[76px] rounded-[14px] z-10 flex items-center px-[30px] gap-[14px]"
        style={{
          background: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(13.621px)',
          border: focusZone === 'list' ? '2.594px solid #ff4199' : '2.594px solid #717171',
          boxShadow: 'inset 1.1px 1.1px 12.1px 0px rgba(255,255,255,0.12)',
        }}
        data-testid="input-search"
       data-tv-gap-axis="row" data-tv-gap="14">
        <div className="w-[31px] h-[31px] flex-shrink-0 opacity-60">
          <img alt="" className="block max-w-none w-full h-full" src={assetPath("images/search-icon.svg")} />
        </div>
        <div className="flex items-center flex-1 min-w-0">
          <span className="font-['Ubuntu',Helvetica] font-medium text-[25.94px] text-white truncate">
            {searchQuery}
          </span>
          <span className="inline-block w-[3px] h-[30px] bg-[#ff4199] ml-[2px] animate-pulse flex-shrink-0" />
          {!searchQuery && (
            <span className="font-['Ubuntu',Helvetica] font-medium text-[25.94px] text-[rgba(255,255,255,0.35)] ml-[4px]">
              {t('search_placeholder') || 'Search...'}
            </span>
          )}
        </div>
        <span className="font-['Ubuntu',Helvetica] text-[16px] text-white/30 flex-shrink-0">
          {visibleSearchResults.length > 0 ? visibleSearchResults.length : ''}
        </span>
      </div>

      <div
        className="absolute left-[246px] top-[200px] z-10"
        style={{ width: '660px', bottom: '30px' }}
      >
        <div
          ref={scrollContainerRef}
          data-testid="search-results-scroll"
          className="absolute left-0 right-0 top-0 bottom-0 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {searchQuery.length > 0 && isSearching && visibleSearchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-[80px] gap-[20px]" data-tv-gap-axis="column" data-tv-gap="20">
              <div className="relative w-[48px] h-[48px]">
                <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#ff4199] animate-spin" />
              </div>
              <span className="font-['Ubuntu',Helvetica] text-[20px] text-white/40 animate-pulse">
                {t('searching') || 'Searching...'}
              </span>
            </div>
          )}

          {searchQuery.length > 0 && visibleSearchResults.length > 0 && visibleSearchResults.map((station, index) => {
            if (!station) return null;
            const isItemFocused = focusZone === 'list' && listFocusIndex === index;
            return (
              <div
                key={station._id || index}
                className={`flex items-center gap-[16px] px-[24px] rounded-[12px] mb-[6px] transition-all duration-150 cursor-pointer h-[110px] ${
                  isItemFocused
                    ? 'bg-[#ff4199]'
                    : 'bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)]'
                }`}
                style={{
                  boxShadow: isItemFocused
                    ? '0 0 20px rgba(255,65,153,0.35), inset 1px 1px 8px rgba(255,255,255,0.1)'
                    : 'none',
                }}
                data-testid={`search-result-${index}`}
                data-station-id={station._id} data-nav-section="search" data-focused={isItemFocused}
                onClick={() => {
                  if (station) {
                    openStation(station, index, 'search');
                  }
                }}
               data-tv-gap-axis="row" data-tv-gap="16">
                <img
                  src={getStationImage(station)}
                  alt=""
                  className={`rounded-[6px] object-cover flex-shrink-0 ${isItemFocused ? 'w-[52px] h-[52px]' : 'w-[46px] h-[46px]'}`}
                  onError={(e) => handleStationImageError(e, station.faviconFallback, FALLBACK_IMAGE)}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <p className={`font-['Ubuntu',Helvetica] font-medium leading-normal not-italic truncate ${isItemFocused ? 'text-[30px] text-white' : 'text-[26px]'}`}>
                    {isItemFocused ? <span className="text-white">{station.name || 'Unknown Station'}</span> : highlightText(station.name || 'Unknown Station', searchQuery)}
                  </p>
                  <p className={`font-['Ubuntu',Helvetica] font-light truncate ${isItemFocused ? 'text-[20px] text-white/80' : 'text-[18px] text-[rgba(255,255,255,0.5)]'}`}>
                    {getStationCategory(station)}
                  </p>
                </div>
              </div>
            );
          })}

          {searchQuery.length > 0 && debouncedSearchQuery.length > 0 && !isSearching && visibleSearchResults.length === 0 && (
            <div className="text-center text-white/50 font-['Ubuntu',Helvetica] text-[20px] mt-[40px]">
              {t('no_results_found') || `No stations found for "${searchQuery}"`}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Keyboard + Language dropdown + Recently Played */}
      <div className="absolute top-[110px] z-10" style={{ left: '960px', width: '700px' }}>
        {KEYBOARD_ROWS.map((row, rowIndex) => {
          const isActionRow = rowIndex === KEYBOARD_ROWS.length - 1;
          return (
            <div key={`${activeLayout.id}-${rowIndex}`} className={`flex ${isActionRow ? 'gap-[10px] mt-[14px]' : 'gap-[6px] mb-[6px]'}`} data-tv-gap-axis="row" data-tv-gap={isActionRow ? 10 : 6}>
              {row.map((keyChar, colIndex) => {
                const isKeyFocused = focusZone === 'keyboard' && keyboardRow === rowIndex && keyboardCol === colIndex;
                const isAction = keyChar === 'SPACE' || keyChar === 'DELETE' || keyChar === 'CLEAR';

                let widthClass = 'w-[92px]';
                if (keyChar === 'SPACE') widthClass = 'flex-1';
                else if (keyChar === 'DELETE' || keyChar === 'CLEAR') widthClass = 'w-[170px]';

                return (
                  <button
                    key={`${activeLayout.id}-${keyChar}-${colIndex}`}
                    onClick={() => {
                      setFocusZone('keyboard');
                      setKeyboardRow(rowIndex);
                      setKeyboardCol(colIndex);
                      handleKeyPress(keyChar);
                    }}
                    className={`h-[68px] ${widthClass} rounded-[12px] font-['Ubuntu',Helvetica] font-medium text-white flex items-center justify-center transition-all duration-150 select-none cursor-pointer ${
                      isKeyFocused
                        ? 'bg-[#ff4199] scale-105 text-[24px]'
                        : isAction
                          ? 'bg-[rgba(255,255,255,0.08)] text-[18px] text-white/70'
                          : 'bg-[rgba(255,255,255,0.14)] text-[22px]'
                    }`}
                    style={{
                      boxShadow: isKeyFocused
                        ? '0 0 25px rgba(255,65,153,0.5), inset 1px 1px 8px rgba(255,255,255,0.15)'
                        : 'inset 1.1px 1.1px 12.1px 0px rgba(255,255,255,0.12)',
                    }}
                    tabIndex={-1}
                    data-testid={`key-${keyChar}`}
                  >
                    {getKeyLabel(keyChar)}
                  </button>
                );
              })}
            </div>
          );
        })}

        <div className="relative mt-[20px]">
          <button
            className={`w-full h-[60px] rounded-[12px] font-['Ubuntu',Helvetica] font-medium text-[20px] flex items-center justify-between px-[24px] transition-all duration-150 select-none ${
              focusZone === 'langButton'
                ? 'bg-[#ff4199] text-white'
                : 'bg-[rgba(255,255,255,0.08)] text-white/70'
            }`}
            style={{
              boxShadow: focusZone === 'langButton'
                ? '0 0 20px rgba(255,65,153,0.4)'
                : 'inset 1.1px 1.1px 12.1px 0px rgba(255,255,255,0.12)',
            }}
            tabIndex={-1}
            data-testid="lang-selector-button"
          >
            <div className="flex items-center gap-[12px]" data-tv-gap-axis="row" data-tv-gap="12">
              <img src={getKbFlagUrl(activeLayout.id)} alt={activeLayout.label} className="w-[32px] h-[22px] rounded-[2px] object-cover" />
              <span>{activeLayout.label}</span>
            </div>
            <span className={`text-[16px] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {dropdownOpen && (
            <div
              className="absolute left-0 right-0 rounded-[14px] overflow-hidden z-20"
              style={{
                bottom: '70px',
                background: 'rgba(30,30,30,0.98)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(255,65,153,0.3)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,65,153,0.15)',
              }}
            >
              <div
                ref={dropdownScrollRef}
                className="overflow-y-auto"
                style={{ maxHeight: '400px', scrollbarWidth: 'none' }}
              >
                {KEYBOARD_LAYOUTS.map((layout, index) => {
                  const isLangFocused = focusZone === 'langDropdown' && dropdownIndex === index;
                  const isActive = activeLayoutIndex === index;
                  return (
                    <div
                      key={layout.id}
                      className={`flex items-center gap-[14px] px-[24px] h-[58px] cursor-pointer transition-all duration-100 ${
                        isLangFocused
                          ? 'bg-[#ff4199] text-white'
                          : isActive
                            ? 'bg-[rgba(255,65,153,0.15)] text-white'
                            : 'text-white/70 hover:bg-[rgba(255,255,255,0.08)]'
                      }`}
                      onClick={() => {
                        setActiveLayoutIndex(index);
                        setDropdownOpen(false);
                        setFocusZone('langButton');
                        setKeyboardRow(0);
                        setKeyboardCol(0);
                      }}
                      data-testid={`layout-${layout.id}`}
                     data-tv-gap-axis="row" data-tv-gap="14">
                      <img src={getKbFlagUrl(layout.id)} alt={layout.label} className="w-[30px] h-[20px] rounded-[2px] object-cover" />
                      <span className="font-['Ubuntu',Helvetica] font-medium text-[19px]">{layout.label}</span>
                      {isActive && !isLangFocused && (
                        <span className="ml-auto text-[#ff4199] text-[16px]">✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recently Played - 2 rows of 4 cards */}
        {recentStations.length > 0 && (
          <div className="mt-[20px]">
            <p className="font-['Ubuntu',Helvetica] font-bold text-[24px] text-white mb-[14px]">
              {t('recently_played') || t('recent') || 'Recently Played'}
            </p>
            <div className="flex flex-wrap gap-[14px]" style={{ width: '690px' }} data-tv-gap-axis="row" data-tv-gap="14" data-tv-gap-wrap="4">
              {recentStations.slice(0, 8).map((station, index) => {
                if (!station) return null;
                const isStationFocused = focusZone === 'recent' && recentFocusIndex === index;
                return (
                  <div
                    key={station._id || index}
                    className={`flex flex-col items-center w-[162px] rounded-[12px] p-[12px] cursor-pointer transition-all duration-150 ${
                      isStationFocused
                        ? 'bg-[#ff4199] scale-105'
                        : 'bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)]'
                    }`}
                    style={{
                      boxShadow: isStationFocused
                        ? '0 0 20px rgba(255,65,153,0.5)'
                        : 'inset 1.1px 1.1px 12.1px 0px rgba(255,255,255,0.12)',
                    }}
                    data-testid={`recent-station-${index}`}
                    data-station-id={station._id} data-nav-section="recent"
                    data-focused={isStationFocused}
                    onClick={() => {
                      if (station) {
                        openStation(station, index, 'recent');
                      }
                    }}
                  >
                    <div className="w-[110px] h-[110px] rounded-[10px] overflow-hidden bg-white mb-[10px] flex-shrink-0">
                      <img
                        alt={station.name || 'Station'}
                        className="w-full h-full object-cover"
                        src={getStationImage(station)}
                        loading="lazy"
                        onError={(e) => handleStationImageError(e, station.faviconFallback, FALLBACK_IMAGE)}
                      />
                    </div>
                    <p className={`font-['Ubuntu',Helvetica] font-medium text-[18px] text-center text-white truncate w-full leading-tight`}>
                      {station.name || 'Unknown'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
