import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { megaRadioApi } from '@/services/megaRadioApi';
import { useLocalization } from '@/contexts/LocalizationContext';
import { assetPath } from '@/lib/assetPath';
import { isTvBackKey } from '@/lib/navigationRestore';
import { useNativeKeyboard } from '@/hooks/useNativeKeyboard';

interface Country {
  name: string;
  code: string;
  flag: string;
  stationcount?: number;
}

interface CountrySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCountry: string;
  onSelectCountry: (country: Country) => void;
  mode?: 'modal' | 'page';
  onNavigateToSidebar?: () => void;
  keyboardDisabled?: boolean;
}

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

export const CountrySelector = ({ isOpen, onClose, selectedCountry, onSelectCountry, mode = 'modal', onNavigateToSidebar, keyboardDisabled = false }: CountrySelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusZone, setFocusZone] = useState<'keyboard' | 'list' | 'langButton' | 'langDropdown'>('keyboard');
  const [keyboardRow, setKeyboardRow] = useState(0);
  const [keyboardCol, setKeyboardCol] = useState(0);
  const [listFocusIndex, setListFocusIndex] = useState(0);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(() => {
    const saved = localStorage.getItem('preferredKeyboard');
    if (saved) {
      const idx = KEYBOARD_LAYOUTS.findIndex(k => k.id === saved);
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
  const { t } = useLocalization();

  const activeLayout = KEYBOARD_LAYOUTS[activeLayoutIndex];
  const KEYBOARD_ROWS = activeLayout.rows;

  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['/api/countries'],
    queryFn: async () => {
      const result = await megaRadioApi.getAllCountries();
      return result;
    },
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
  });

  const countries: Country[] = useMemo(() => {
    const apiCountries = countriesData?.countries || [];
    return apiCountries
      .filter(country => country.name && country.iso_3166_1)
      .map(country => {
        const flagUrl = country.iso_3166_1 === 'XX' || country.iso_3166_1.length !== 2
          ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23979797"/%3E%3C/svg%3E'
          : `https://flagcdn.com/w40/${country.iso_3166_1.toLowerCase()}.png`;
        return {
          name: country.name,
          code: country.iso_3166_1,
          flag: flagUrl,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countriesData]);

  const filteredCountries = useMemo(() => {
    const globalOption: Country = {
      name: 'Global',
      code: 'GLOBAL',
      flag: assetPath('images/globe-icon.svg'),
    };

    const filtered = countries
      .filter(country => country.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (!searchQuery) return a.name.localeCompare(b.name);
        const queryLower = searchQuery.toLowerCase();
        const aStarts = a.name.toLowerCase().startsWith(queryLower);
        const bStarts = b.name.toLowerCase().startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });

    filtered.unshift(globalOption);
    return filtered;
  }, [countries, searchQuery]);

  useEffect(() => {
    if (filteredCountries.length > 0 && listFocusIndex >= filteredCountries.length) {
      setListFocusIndex(0);
    }
  }, [filteredCountries.length, listFocusIndex]);

  useEffect(() => {
    if (scrollContainerRef.current && searchQuery) {
      scrollContainerRef.current.scrollTop = 0;
      setListFocusIndex(0);
    }
  }, [searchQuery]);

  // Physical keyboard support (Desktop / Electron). Delegated to the shared
  // useNativeKeyboard hook so the behaviour stays identical across pages.
  // We listen in capture phase so we run before the internal D-pad handler
  // (which unconditionally stopPropagation()s on every keydown).
  useNativeKeyboard({
    enabled: isOpen && !keyboardDisabled && !dropdownOpen,
    capture: true,
    onChar: (c) => setSearchQuery(prev => prev + c),
    onBackspace: () => setSearchQuery(prev => prev.slice(0, -1)),
    onEscape: () => onClose?.(),
  });

  useEffect(() => {
    if (focusZone !== 'list' || !scrollContainerRef.current || filteredCountries.length === 0) return;
    const container = scrollContainerRef.current;
    const focusedElement = container.children[listFocusIndex] as HTMLElement | undefined;
    if (!focusedElement) return;

    const TOP_PADDING = 20;
    const BOTTOM_PADDING = 60;
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
  }, [listFocusIndex, filteredCountries.length, focusZone]);

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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keyboardDisabled || e.defaultPrevented) return;
      const key = (window as any).tvKey;

      const keyCode = e.keyCode;
      const isUp = keyCode === 38 || keyCode === key?.UP;
      const isDown = keyCode === 40 || keyCode === key?.DOWN;
      const isLeft = keyCode === 37 || keyCode === key?.LEFT;
      const isRight = keyCode === 39 || keyCode === key?.RIGHT;
      const isEnter = keyCode === 13 || keyCode === key?.ENTER;
      const isBack = isTvBackKey(e) || keyCode === key?.RETURN;
      if (isUp || isDown || isLeft || isRight || isEnter || isBack) e.stopPropagation();

      if (isBack) {
        e.preventDefault();
        if (mode === 'modal') e.stopImmediatePropagation();
        if (dropdownOpen) {
          setDropdownOpen(false);
          setFocusZone('langButton');
          return;
        }
        onClose();
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
        } else if (isBack || isLeft) {
          e.preventDefault();
          setDropdownOpen(false);
          setFocusZone('langButton');
        }
        return;
      }

      if (focusZone === 'langButton') {
        if (isUp) {
          e.preventDefault();
          setFocusZone('keyboard');
          setKeyboardRow(KEYBOARD_ROWS.length - 1);
          setKeyboardCol(0);
        } else if (isEnter) {
          e.preventDefault();
          setDropdownOpen(true);
          setDropdownIndex(activeLayoutIndex);
          setFocusZone('langDropdown');
        } else if (isLeft) {
          e.preventDefault();
          lastKeyboardPos.current = { row: KEYBOARD_ROWS.length - 1, col: 0 };
          setFocusZone('list');
          setListFocusIndex(lastListPos.current);
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
            setFocusZone('list');
            setListFocusIndex(lastListPos.current);
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
      } else if (focusZone === 'list') {
        if (isUp) {
          e.preventDefault();
          setListFocusIndex(prev => Math.max(0, prev - 1));
        } else if (isDown) {
          e.preventDefault();
          setListFocusIndex(prev => Math.min(filteredCountries.length - 1, prev + 1));
        } else if (isRight) {
          e.preventDefault();
          lastListPos.current = listFocusIndex;
          setFocusZone('keyboard');
          setKeyboardRow(lastKeyboardPos.current.row);
          setKeyboardCol(lastKeyboardPos.current.col);
        } else if (isLeft) {
          e.preventDefault();
          if (mode === 'page' && onNavigateToSidebar) {
            onNavigateToSidebar();
          }
        } else if (isEnter) {
          e.preventDefault();
          if (filteredCountries[listFocusIndex]) {
            onSelectCountry(filteredCountries[listFocusIndex]);
            onClose();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, mode === 'modal');
    return () => document.removeEventListener('keydown', handleKeyDown, mode === 'modal');
  }, [isOpen, focusZone, keyboardRow, keyboardCol, listFocusIndex, filteredCountries, onSelectCountry, onClose, handleKeyPress, keyboardDisabled, mode, onNavigateToSidebar, activeLayoutIndex, dropdownOpen, dropdownIndex, KEYBOARD_ROWS]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setFocusZone('keyboard');
      setKeyboardRow(0);
      setKeyboardCol(0);
      setListFocusIndex(0);
      setDropdownOpen(false);
      lastKeyboardPos.current = { row: 0, col: 0 };
      lastListPos.current = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getKeyLabel = (key: string) => {
    if (key === 'SPACE') return 'SPACE';
    if (key === 'DELETE') return '⌫';
    if (key === 'CLEAR') return 'CLEAR';
    return key;
  };

  const highlightMatch = (name: string) => {
    if (!searchQuery) return <span>{name}</span>;
    const idx = name.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx === -1) return <span>{name}</span>;
    return (
      <>
        <span>{name.substring(0, idx)}</span>
        <span className="text-[#ff4199]">{name.substring(idx, idx + searchQuery.length)}</span>
        <span>{name.substring(idx + searchQuery.length)}</span>
      </>
    );
  };

  return (
    <div
      className={`absolute top-0 left-0 w-[1920px] h-[1080px] ${mode === 'page' ? 'z-30' : 'z-50'}`}
      onKeyDown={(e) => { e.stopPropagation(); }}
      data-testid="country-selector-fullpage"
    >
      {mode === 'modal' && (
        <div className="absolute top-0 left-0 w-[1920px] h-[1080px] bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]" />
      )}

      <div className="absolute top-0 left-0 w-[1920px] h-[1080px]">
        <div className="absolute left-[30px] top-[40px] w-[164.421px] h-[57px] z-10">
          <p className="absolute bottom-0 left-[18.67%] right-0 top-[46.16%] font-['Ubuntu',Helvetica] text-[27.029px] text-white leading-normal whitespace-pre-wrap">
            <span className="font-bold">mega</span>radio
          </p>
          <div className="absolute bottom-[2.84%] left-0 right-[65.2%] top-0">
            <img alt="" className="block max-w-none w-full h-full" src={assetPath("images/path-8.svg")} />
          </div>
        </div>

        <p className="absolute font-['Ubuntu',Helvetica] font-bold leading-normal left-[246px] top-[42px] text-[32px] text-white z-10">
          {t('select_country') || 'Select Country'}
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
                {t('search_countries') || 'Search countries...'}
              </span>
            )}
          </div>
          <span className="font-['Ubuntu',Helvetica] text-[16px] text-white/30 flex-shrink-0">
            {filteredCountries.length - 1}
          </span>
        </div>

        <div
          className="absolute left-[246px] top-[200px] z-10"
          style={{ width: '660px', bottom: '30px' }}
        >
          <div
            ref={scrollContainerRef}
            className="absolute left-0 right-0 top-0 bottom-0 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {countriesLoading ? (
              <div className="text-center text-white/50 font-['Ubuntu',Helvetica] text-[22px] mt-[80px]">
                {t('loading') || 'Loading...'}
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center text-white/50 font-['Ubuntu',Helvetica] text-[20px] mt-[40px]">
                {t('no_countries_found') || 'No countries found'}
              </div>
            ) : (
              filteredCountries.map((country, index) => {
                const isItemFocused = focusZone === 'list' && listFocusIndex === index;
                const isSelected = country.name === selectedCountry;
                return (
                  <div
                    key={`${country.code}-${index}`}
                    className={`flex items-center gap-[16px] px-[24px] rounded-[12px] mb-[6px] transition-all duration-150 cursor-pointer h-[110px] ${
                      isItemFocused
                        ? 'bg-[#ff4199]'
                        : isSelected
                          ? 'bg-[rgba(255,65,153,0.15)]'
                          : 'bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)]'
                    }`}
                    style={{
                      boxShadow: isItemFocused
                        ? '0 0 20px rgba(255,65,153,0.35), inset 1px 1px 8px rgba(255,255,255,0.1)'
                        : isSelected
                          ? 'inset 1px 1px 8px rgba(255,65,153,0.15)'
                          : 'none',
                    }}
                    onClick={() => { onSelectCountry(country); onClose(); }}
                    data-testid={`country-option-${country.code}`}
                   data-tv-gap-axis="row" data-tv-gap="16">
                    <img
                      src={country.flag}
                      alt={country.name}
                      className={`${country.code === 'GLOBAL' ? 'object-contain' : 'object-cover'} rounded-[6px] flex-shrink-0 ${isItemFocused ? 'w-[52px] h-[39px]' : 'w-[46px] h-[34px]'}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="30"%3E%3Crect width="40" height="30" fill="%23979797"/%3E%3C/svg%3E';
                      }}
                    />
                    <span className={`font-['Ubuntu',Helvetica] font-medium text-white truncate ${isItemFocused ? 'text-[30px]' : 'text-[26px]'}`}>
                      {highlightMatch(country.name)}
                    </span>
                    {isSelected && !isItemFocused && (
                      <span className="ml-auto font-['Ubuntu',Helvetica] text-[16px] text-[#ff4199] flex-shrink-0">✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Keyboard + Language dropdown below */}
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

          {/* Language selector button + dropdown */}
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
                    const isFocused = focusZone === 'langDropdown' && dropdownIndex === index;
                    const isActive = activeLayoutIndex === index;
                    return (
                      <div
                        key={layout.id}
                        className={`flex items-center gap-[14px] px-[24px] h-[58px] cursor-pointer transition-all duration-100 ${
                          isFocused
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
                        {isActive && !isFocused && (
                          <span className="ml-auto text-[#ff4199] text-[16px]">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-[20px] mt-[16px] px-[4px]" data-tv-gap-axis="row" data-tv-gap="20">
            <div className="flex items-center gap-[6px]" data-tv-gap-axis="row" data-tv-gap="6">
              <div className="w-[28px] h-[28px] rounded-[6px] bg-[rgba(255,255,255,0.14)] flex items-center justify-center" style={{ boxShadow: 'inset 1px 1px 6px rgba(255,255,255,0.12)' }}>
                <span className="text-white/60 text-[14px]">←</span>
              </div>
              <span className="font-['Ubuntu',Helvetica] text-[16px] text-white/30">{t('results') || 'Results'}</span>
            </div>
            <div className="flex items-center gap-[6px]" data-tv-gap-axis="row" data-tv-gap="6">
              <div className="w-[28px] h-[28px] rounded-[6px] bg-[rgba(255,255,255,0.14)] flex items-center justify-center" style={{ boxShadow: 'inset 1px 1px 6px rgba(255,255,255,0.12)' }}>
                <span className="text-white/60 text-[14px]">OK</span>
              </div>
              <span className="font-['Ubuntu',Helvetica] text-[16px] text-white/30">{t('type') || 'Type'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
