import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { useSleepTimer } from "@/contexts/SleepTimerContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Sidebar } from "@/components/Sidebar";
import { TV_LAYOUT } from '@/lib/tvLayout';
import { useHelp } from "@/contexts/HelpContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCast } from "@/contexts/CastContext";
import { usePaywall } from "@/contexts/PaywallContext";
import { isMacAppStore } from "@/lib/platform";
import { assetPath } from "@/lib/assetPath";

type PlayAtStartMode = "last-played" | "random" | "favorite" | "none";

interface KeyboardOption {
  id: string;
  label: string;
  country: string;
}

interface LanguageOption {
  code: string;
  label: string;
  country: string;
}

const KEYBOARD_OPTIONS: KeyboardOption[] = [
  { id: 'en', label: 'English', country: 'GB' },
  { id: 'tr', label: 'Türkçe', country: 'TR' },
  { id: 'ar', label: 'العربية', country: 'SA' },
  { id: 'ru', label: 'Русский', country: 'RU' },
  { id: 'de', label: 'Deutsch', country: 'DE' },
  { id: 'fr', label: 'Français', country: 'FR' },
  { id: 'es', label: 'Español', country: 'ES' },
  { id: 'ja', label: '日本語', country: 'JP' },
  { id: 'zh', label: '中文', country: 'CN' },
  { id: 'ko', label: '한국어', country: 'KR' },
  { id: 'el', label: 'Ελληνικά', country: 'GR' },
  { id: 'hi', label: 'हिन्दी', country: 'IN' },
  { id: 'th', label: 'ไทย', country: 'TH' },
];

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', country: 'US' },
  { code: 'de', label: 'Deutsch', country: 'DE' },
  { code: 'fr', label: 'Français', country: 'FR' },
  { code: 'es', label: 'Español', country: 'ES' },
  { code: 'it', label: 'Italiano', country: 'IT' },
  { code: 'pt', label: 'Português', country: 'PT' },
  { code: 'ru', label: 'Русский', country: 'RU' },
  { code: 'ja', label: '日本語', country: 'JP' },
  { code: 'zh', label: '中文', country: 'CN' },
  { code: 'ar', label: 'العربية', country: 'SA' },
  { code: 'tr', label: 'Türkçe', country: 'TR' },
  { code: 'pl', label: 'Polski', country: 'PL' },
  { code: 'nl', label: 'Nederlands', country: 'NL' },
  { code: 'sv', label: 'Svenska', country: 'SE' },
  { code: 'no', label: 'Norsk', country: 'NO' },
  { code: 'da', label: 'Dansk', country: 'DK' },
  { code: 'fi', label: 'Suomi', country: 'FI' },
  { code: 'cs', label: 'Čeština', country: 'CZ' },
  { code: 'hu', label: 'Magyar', country: 'HU' },
  { code: 'ro', label: 'Română', country: 'RO' },
  { code: 'el', label: 'Ελληνικά', country: 'GR' },
  { code: 'th', label: 'ไทย', country: 'TH' },
  { code: 'ko', label: '한국어', country: 'KR' },
  { code: 'vi', label: 'Tiếng Việt', country: 'VN' },
  { code: 'id', label: 'Bahasa Indonesia', country: 'ID' },
  { code: 'ms', label: 'Bahasa Melayu', country: 'MY' },
  { code: 'hi', label: 'हिन्दी', country: 'IN' },
  { code: 'bn', label: 'বাংলা', country: 'BD' },
  { code: 'ta', label: 'தமிழ்', country: 'IN' },
  { code: 'te', label: 'తెలుగు', country: 'IN' },
  { code: 'ur', label: 'اردو', country: 'PK' },
  { code: 'fa', label: 'فارسی', country: 'IR' },
  { code: 'he', label: 'עברית', country: 'IL' },
  { code: 'uk', label: 'Українська', country: 'UA' },
  { code: 'bg', label: 'Български', country: 'BG' },
  { code: 'sr', label: 'Српски', country: 'RS' },
  { code: 'hr', label: 'Hrvatski', country: 'HR' },
  { code: 'sk', label: 'Slovenčina', country: 'SK' },
  { code: 'sl', label: 'Slovenščina', country: 'SI' },
  { code: 'et', label: 'Eesti', country: 'EE' },
  { code: 'lv', label: 'Latviešu', country: 'LV' },
  { code: 'lt', label: 'Lietuvių', country: 'LT' },
  { code: 'is', label: 'Íslenska', country: 'IS' },
  { code: 'ga', label: 'Gaeilge', country: 'IE' },
  { code: 'sq', label: 'Shqip', country: 'AL' },
  { code: 'mk', label: 'Македонски', country: 'MK' },
  { code: 'am', label: 'አማርኛ', country: 'ET' },
  { code: 'sw', label: 'Kiswahili', country: 'KE' },
];

const getFlagUrl = (countryCode: string) =>
  `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;

type SettingsCategory = 'language' | 'keyboard' | 'playback' | 'timer' | 'accessibility' | 'account' | 'cast' | 'legal';

function CategoryIcon({ type }: { type: SettingsCategory }) {
  const size = 24;
  const fill = '#ffffff';
  switch (type) {
    case 'language':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={fill} strokeWidth="1.5" fill="none" />
          <ellipse cx="12" cy="12" rx="5" ry="10" stroke={fill} strokeWidth="1.5" fill="none" />
          <line x1="2" y1="12" x2="22" y2="12" stroke={fill} strokeWidth="1.5" />
          <line x1="12" y1="2" x2="12" y2="22" stroke={fill} strokeWidth="1.5" />
        </svg>
      );
    case 'keyboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke={fill} strokeWidth="1.5" fill="none" />
          <line x1="6" y1="9" x2="8" y2="9" stroke={fill} strokeWidth="1.5" />
          <line x1="11" y1="9" x2="13" y2="9" stroke={fill} strokeWidth="1.5" />
          <line x1="16" y1="9" x2="18" y2="9" stroke={fill} strokeWidth="1.5" />
          <line x1="6" y1="15" x2="18" y2="15" stroke={fill} strokeWidth="1.5" />
        </svg>
      );
    case 'playback':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <polygon points="8,5 20,12 8,19" fill={fill} />
        </svg>
      );
    case 'timer':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="13" r="9" stroke={fill} strokeWidth="1.5" fill="none" />
          <line x1="12" y1="13" x2="12" y2="7" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="13" x2="16" y2="13" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="2" x2="14" y2="2" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'accessibility':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="2.5" fill={fill} />
          <line x1="12" y1="8" x2="12" y2="16" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="10" x2="17" y2="10" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="16" x2="8" y2="22" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="16" x2="16" y2="22" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'legal':
      return <span aria-hidden="true" style={{ fontSize: 26 }}>§</span>;
    case 'account':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={fill} strokeWidth="1.5" fill="none" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={fill} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'cast':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="2" y1="20" x2="2.01" y2="20" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export const Settings = (): JSX.Element => {
  const { t, language, setLanguage } = useLocalization();
  const macStore = isMacAppStore();
  const { sleepTimerMinutes, remainingSeconds, setSleepTimer, cancelSleepTimer, isTimerActive } = useSleepTimer();
  const [, setLocation] = useLocation();
  const [playAtStart, setPlayAtStart] = useState<PlayAtStartMode>("none");
  const [selectedKeyboard, setSelectedKeyboard] = useState(0);
  const { highContrast, largeText, setHighContrast, setLargeText } = useAccessibility();
  const { isAuthenticated, user, logout } = useAuth();
  const { isConnected } = useCast();
  const { showPaywall, isPremium } = usePaywall();

  const { openHelp, closeHelp, helpOpen } = useHelp();
  const [helpFocused, setHelpFocused] = useState(false);
  const helpFocusedRef = useRef(false);
  const helpOpenRef = useRef(false);
  helpFocusedRef.current = helpFocused;
  helpOpenRef.current = helpOpen;
  const setHF = (v: boolean) => { helpFocusedRef.current = v; setHelpFocused(v); };
  const [focusSection, setFocusSection] = useState<'sidebar' | 'categories' | 'options' | 'premium'>('categories');
  const [sidebarIndex, setSidebarIndex] = useState(5);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [optionIndex, setOptionIndex] = useState(0);

  const optionListRef = useRef<HTMLDivElement>(null);

  const categories: SettingsCategory[] = ['language', 'keyboard', 'playback', 'timer', 'accessibility', 'account', 'cast', ...(macStore ? ['legal' as const] : [])];

  const sleepTimerOptions: (number | null)[] = [15, 30, 60, 120, null];
  const sleepTimerLabels: Record<string, string> = {
    '15': t('sleep_timer_15') || '15 min',
    '30': t('sleep_timer_30') || '30 min',
    '60': t('sleep_timer_60') || '1 hour',
    '120': t('sleep_timer_120') || '2 hours',
    'null': t('sleep_timer_off') || 'Off',
  };

  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sidebarRoutes = ['/discover-no-user', '/genres', '/search', '/favorites', '/country-select', '/settings'];
  const settingsOptions: PlayAtStartMode[] = ["last-played", "random", "favorite", "none"];

  const isFocused = (idx: number) => focusSection === 'sidebar' && sidebarIndex === idx;
  const getFocusClasses = (_focused: boolean) => '';

  const getCategoryLabel = (cat: SettingsCategory): string => {
    switch (cat) {
      case 'language': return t('select_language') || 'Language';
      case 'keyboard': return t('select_keyboard') || 'Keyboard';
      case 'playback': return t('settings_play_at_start') || 'Playback';
      case 'timer': return t('sleep_timer') || 'Sleep Timer';
      case 'accessibility': return t('accessibility') || 'Accessibility';
      case 'account': return t('account') || 'Account';
      case 'cast': return t('cast') || 'Cast';
      case 'legal': return 'Privacy & Terms';
    }
  };

  const getOptionCount = (): number => {
    switch (categories[categoryIndex]) {
      case 'language': return LANGUAGE_OPTIONS.length;
      case 'keyboard': return KEYBOARD_OPTIONS.length;
      case 'playback': return settingsOptions.length;
      case 'timer': return sleepTimerOptions.length;
      case 'accessibility': return 2;
      case 'account': return macStore ? 2 : 1;
      case 'cast': return 1;
      case 'legal': return 2;
      default: return 0;
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("playAtStart");
    if (saved && settingsOptions.includes(saved as PlayAtStartMode)) {
      setPlayAtStart(saved as PlayAtStartMode);
    }
    const savedKb = localStorage.getItem("preferredKeyboard");
    if (savedKb) {
      const idx = KEYBOARD_OPTIONS.findIndex(k => k.id === savedKb);
      if (idx >= 0) {
        setSelectedKeyboard(idx);
      }
    }
  }, []);

  useEffect(() => {
    setOptionIndex(0);
    if (optionListRef.current) {
      optionListRef.current.scrollTop = 0;
    }
  }, [categoryIndex]);

  useEffect(() => {
    if (focusSection === 'options' && optionListRef.current) {
      const container = optionListRef.current;
      const itemHeight = 72;
      const itemTop = optionIndex * itemHeight;
      const itemBottom = itemTop + itemHeight;
      const scrollTop = container.scrollTop;
      const viewHeight = container.clientHeight;
      if (itemTop < scrollTop) {
        container.scrollTop = itemTop;
      } else if (itemBottom > scrollTop + viewHeight) {
        container.scrollTop = itemBottom - viewHeight;
      }
    }
  }, [optionIndex, focusSection]);

  const handlePlayAtStartChange = (mode: PlayAtStartMode) => {
    setPlayAtStart(mode);
    localStorage.setItem("playAtStart", mode);
  };

  const handleKeyboardChange = (index: number) => {
    setSelectedKeyboard(index);
    localStorage.setItem("preferredKeyboard", KEYBOARD_OPTIONS[index].id);
  };

  const handleLanguageChange = (index: number) => {
    setLanguage(LANGUAGE_OPTIONS[index].code);
  };

  const handleOptionSelect = () => {
    const cat = categories[categoryIndex];
    switch (cat) {
      case 'language':
        handleLanguageChange(optionIndex);
        break;
      case 'keyboard':
        handleKeyboardChange(optionIndex);
        break;
      case 'playback':
        handlePlayAtStartChange(settingsOptions[optionIndex]);
        break;
      case 'timer': {
        const opt = sleepTimerOptions[optionIndex];
        if (opt === null) cancelSleepTimer();
        else setSleepTimer(opt);
        break;
      }
      case 'accessibility':
        if (optionIndex === 0) setHighContrast(!highContrast);
        else setLargeText(!largeText);
        break;
      case 'account':
        if (macStore && optionIndex === 0) { setLocation('/premium-upgrade'); break; }
        if (isAuthenticated) {
          logout();
        } else {
          setLocation('/login');
        }
        break;
      case 'legal':
        setLocation(optionIndex === 0 ? '/privacy' : '/terms');
        break;
      case 'cast':
        break;
    }
  };

  usePageKeyHandler('/settings', (e) => {
    e.stopPropagation();
    const key = (window as any).tvKey;
    const isUp = e.keyCode === key?.UP || e.keyCode === 38;
    const isDown = e.keyCode === key?.DOWN || e.keyCode === 40;
    const isLeft = e.keyCode === key?.LEFT || e.keyCode === 37;
    const isRight = e.keyCode === key?.RIGHT || e.keyCode === 39;
    const isEnter = e.keyCode === key?.ENTER || e.keyCode === 13;
    const isReturn = e.keyCode === key?.RETURN || e.keyCode === 461 || e.keyCode === 10009;

    // Help modal open — block all page navigation; ENTER/BACK closes popup
    if (helpOpenRef.current) {
      e.preventDefault();
      if (isReturn || isEnter) { closeHelp(); }
      return;
    }

    if (isReturn) {
      e.preventDefault();
      if (helpFocusedRef.current) { setHF(false); return; }
      if (focusSection === 'options') {
        setFocusSection('categories');
      } else if (focusSection === 'categories') {
        setFocusSection('sidebar');
      } else {
        setLocation('/discover-no-user');
      }
      return;
    }

    if (focusSection === 'sidebar') {
      // Help button focus mode
      if (helpFocusedRef.current) {
        if (isUp) { e.preventDefault(); setHF(false); }
        else if (isEnter) { e.preventDefault(); openHelp(); }
        else if (isRight) { e.preventDefault(); setHF(false); setFocusSection('categories'); }
        return;
      }
      if (isUp) { e.preventDefault(); setSidebarIndex(prev => Math.max(0, prev - 1)); }
      else if (isDown) { e.preventDefault(); if (sidebarIndex < 5) { setSidebarIndex(prev => prev + 1); } else { setHF(true); } }
      else if (isRight) { e.preventDefault(); setFocusSection('categories'); }
      else if (isEnter) { e.preventDefault(); setLocation(sidebarRoutes[sidebarIndex]); }
      return;
    }

    if (focusSection === 'categories') {
      if (isUp) { e.preventDefault(); setCategoryIndex(prev => Math.max(0, prev - 1)); }
      else if (isDown) {
        e.preventDefault();
        if (categoryIndex < categories.length - 1) {
          setCategoryIndex(prev => prev + 1);
        } else if (!isPremium && !macStore) {
          // Past the last category — jump to Go Premium button
          setFocusSection('premium');
        }
      }
      else if (isLeft) { e.preventDefault(); setFocusSection('sidebar'); }
      else if (isRight || isEnter) { e.preventDefault(); setFocusSection('options'); setOptionIndex(0); }
      return;
    }

    if (focusSection === 'premium') {
      if (isUp) { e.preventDefault(); setFocusSection('categories'); setCategoryIndex(categories.length - 1); }
      else if (isLeft) { e.preventDefault(); setFocusSection('sidebar'); }
      else if (isEnter) { e.preventDefault(); showPaywall('premium'); }
      return;
    }

    if (focusSection === 'options') {
      var currentCat = categories[categoryIndex];

      if (currentCat === 'cast') {
        if (isLeft) { e.preventDefault(); setFocusSection('categories'); }
        return;
      }

      var maxIdx = getOptionCount() - 1;
      if (isUp) { e.preventDefault(); if (optionIndex > 0) setOptionIndex(function(prev) { return prev - 1; }); }
      else if (isDown) { e.preventDefault(); if (optionIndex < maxIdx) setOptionIndex(function(prev) { return prev + 1; }); }
      else if (isLeft) { e.preventDefault(); setFocusSection('categories'); }
      else if (isEnter) { e.preventDefault(); handleOptionSelect(); }
      return;
    }
  });

  const playAtStartLabels: Record<PlayAtStartMode, string> = {
    "last-played": t('settings_last_played') || 'Last Played',
    "random": t('settings_random') || 'Random',
    "favorite": t('settings_favorite') || 'Favorite',
    "none": t('settings_none') || 'None',
  };

  const selectedLang = LANGUAGE_OPTIONS.find(l => l.code === language) || LANGUAGE_OPTIONS[0];
  const selectedKb = KEYBOARD_OPTIONS[selectedKeyboard];

  const renderCategoryDescription = (): string => {
    const cat = categories[categoryIndex];
    switch (cat) {
      case 'language': return selectedLang.label;
      case 'keyboard': return selectedKb.label;
      case 'playback': return playAtStartLabels[playAtStart];
      case 'timer': return isTimerActive && remainingSeconds !== null
        ? `${sleepTimerLabels[String(sleepTimerMinutes)]} (${formatRemainingTime(remainingSeconds)})`
        : sleepTimerMinutes !== null ? sleepTimerLabels[String(sleepTimerMinutes)] : (t('sleep_timer_off') || 'Off');
      case 'accessibility': {
        const active: string[] = [];
        if (highContrast) active.push(t('high_contrast') || 'High Contrast');
        if (largeText) active.push(t('large_text') || 'Large Text');
        return active.length > 0 ? active.join(', ') : (t('settings_none') || 'None');
      }
      case 'account':
        return isAuthenticated ? (user ? user.name : (t('logged_in') || 'Logged In')) : (t('not_logged_in') || 'Not Logged In');
      case 'cast':
        if (isConnected) return t('cast_connected') || 'Connected';
        return isAuthenticated ? (t('cast_waiting') || 'Waiting for mobile...') : (t('not_logged_in') || 'Not Logged In');
      default: return '';
    }
  };

  var optionRowBase = {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: '20px',
    height: '68px',
    paddingLeft: '24px',
    paddingRight: '24px',
    borderRadius: '14px',
    cursor: 'pointer',
    flexShrink: 0,
  };

  var getOptionRowBg = (focused: boolean, selected: boolean) =>
    focused ? '#ff4199' : selected ? 'rgba(255,65,153,0.12)' : 'transparent';

  var getOptionRowShadow = (focused: boolean) =>
    focused ? '0 0 24px rgba(255,65,153,0.3)' : 'none';

  var checkmarkStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#ff4199',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  var optionTextStyle = {
    fontWeight: 500,
    fontSize: '22px',
    color: '#ffffff',
    flex: 1,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    margin: 0,
  };

  var radioStyle = (selected: boolean) => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid ' + (selected ? '#ff4199' : 'rgba(255,255,255,0.3)'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  var radioDotStyle = {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#ff4199',
  };

  var flagStyle = {
    width: '40px',
    height: '28px',
    borderRadius: '4px',
    objectFit: 'cover' as const,
    flexShrink: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  };

  const renderOptions = () => {
    const cat = categories[categoryIndex];
    const isFocusedOnOptions = focusSection === 'options';

    switch (cat) {
      case 'language':
        return LANGUAGE_OPTIONS.map((lang, index) => {
          const isItemFocused = isFocusedOnOptions && optionIndex === index;
          const isSelected = language === lang.code;
          return (
            <div
              key={lang.code}
              style={{ ...optionRowBase, backgroundColor: getOptionRowBg(isItemFocused, isSelected), boxShadow: getOptionRowShadow(isItemFocused) }}
              onClick={() => { handleLanguageChange(index); }}
              data-testid={`language-${lang.code}`}
            >
              <img src={getFlagUrl(lang.country)} alt={lang.label} style={flagStyle} />
              <p className="font-['Ubuntu',Helvetica]" style={optionTextStyle}>
                {lang.label}
              </p>
              {isSelected && (
                <div style={checkmarkStyle}>
                  <span style={{ color: '#ffffff', fontSize: '16px' }}>✓</span>
                </div>
              )}
            </div>
          );
        });

      case 'keyboard':
        return KEYBOARD_OPTIONS.map((kb, index) => {
          const isItemFocused = isFocusedOnOptions && optionIndex === index;
          const isSelected = selectedKeyboard === index;
          return (
            <div
              key={kb.id}
              style={{ ...optionRowBase, backgroundColor: getOptionRowBg(isItemFocused, isSelected), boxShadow: getOptionRowShadow(isItemFocused) }}
              onClick={() => { handleKeyboardChange(index); }}
              data-testid={`keyboard-${kb.id}`}
            >
              <img src={getFlagUrl(kb.country)} alt={kb.label} style={flagStyle} />
              <p className="font-['Ubuntu',Helvetica]" style={optionTextStyle}>
                {kb.label}
              </p>
              {isSelected && (
                <div style={checkmarkStyle}>
                  <span style={{ color: '#ffffff', fontSize: '16px' }}>✓</span>
                </div>
              )}
            </div>
          );
        });

      case 'playback':
        return settingsOptions.map((option, index) => {
          const isItemFocused = isFocusedOnOptions && optionIndex === index;
          const isSelected = playAtStart === option;
          return (
            <div
              key={option}
              style={{ ...optionRowBase, backgroundColor: getOptionRowBg(isItemFocused, isSelected), boxShadow: getOptionRowShadow(isItemFocused) }}
              onClick={() => handlePlayAtStartChange(option)}
              data-testid={`option-${option}`}
            >
              <div style={radioStyle(isSelected)}>
                {isSelected && <div style={radioDotStyle} />}
              </div>
              <p className="font-['Ubuntu',Helvetica]" style={optionTextStyle}>
                {playAtStartLabels[option]}
              </p>
            </div>
          );
        });

      case 'timer':
        return (
          <>
            {isTimerActive && remainingSeconds !== null && (
              <div
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', height: '56px', paddingLeft: '24px', paddingRight: '24px', marginBottom: '8px', borderRadius: '14px', backgroundColor: 'rgba(255,65,153,0.1)', border: '1px solid rgba(255,65,153,0.25)', flexShrink: 0 }}
                data-testid="sleep-timer-remaining"
              >
                <span style={{ fontSize: '20px' }}>💤</span>
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 700, fontSize: '20px', color: '#ff4199', margin: 0 }}>
                  {formatRemainingTime(remainingSeconds)}
                </p>
              </div>
            )}
            {sleepTimerOptions.map((option, index) => {
              const isItemFocused = isFocusedOnOptions && optionIndex === index;
              const optionKey = option === null ? 'null' : String(option);
              const isSelected = option === null ? sleepTimerMinutes === null : sleepTimerMinutes === option;
              return (
                <div
                  key={optionKey}
                  style={{ ...optionRowBase, backgroundColor: getOptionRowBg(isItemFocused, isSelected), boxShadow: getOptionRowShadow(isItemFocused) }}
                  onClick={() => { option === null ? cancelSleepTimer() : setSleepTimer(option); }}
                  data-testid={`sleep-timer-${optionKey}`}
                >
                  <div style={radioStyle(isSelected)}>
                    {isSelected && <div style={radioDotStyle} />}
                  </div>
                  <p className="font-['Ubuntu',Helvetica]" style={optionTextStyle}>
                    {sleepTimerLabels[optionKey]}
                  </p>
                </div>
              );
            })}
          </>
        );

      case 'accessibility':
        return [
          { label: t('high_contrast') || 'High Contrast', value: highContrast, toggle: () => setHighContrast(!highContrast), testId: 'toggle-high-contrast', desc: t('high_contrast_desc') || 'Increases text and element visibility' },
          { label: t('large_text') || 'Large Text', value: largeText, toggle: () => setLargeText(!largeText), testId: 'toggle-large-text', desc: t('large_text_desc') || 'Makes all text 15% larger' },
        ].map((item, index) => {
          const isItemFocused = isFocusedOnOptions && optionIndex === index;
          return (
            <div
              key={item.testId}
              style={{
                display: 'flex',
                flexDirection: 'row' as const,
                alignItems: 'center',
                gap: '20px',
                height: '88px',
                paddingLeft: '24px',
                paddingRight: '24px',
                borderRadius: '14px',
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: isItemFocused ? 'rgba(255,65,153,0.15)' : 'transparent',
                boxShadow: isItemFocused ? '0 0 24px rgba(255,65,153,0.15)' : 'none',
              }}
              onClick={item.toggle}
              data-testid={item.testId}
            >
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 500, fontSize: '22px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {item.label}
                </p>
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '16px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {item.desc}
                </p>
              </div>
              <div style={{
                width: '60px',
                height: '34px',
                borderRadius: '9999px',
                flexShrink: 0,
                position: 'relative' as const,
                backgroundColor: item.value ? '#ff4199' : 'rgba(255,255,255,0.15)',
                transition: 'background-color 0.2s',
              }}>
                <div style={{
                  position: 'absolute' as const,
                  top: '4px',
                  left: item.value ? '30px' : '4px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
          );
        });

      case 'legal':
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ color: '#aaa', fontSize: 22 }}>Read these documents here, including when offline. No sign-in is required.</p>
          {(['Privacy Policy', 'Terms of Use (EULA)'] as const).map((label, index) => <button key={label} data-testid={index === 0 ? 'settings-privacy' : 'settings-terms'} onClick={() => setLocation(index === 0 ? '/privacy' : '/terms')} style={{ padding: 24, borderRadius: 16, background: '#252525', color: '#fff', fontSize: 26, textAlign: 'left', border: focusSection === 'options' && optionIndex === index ? '3px solid #ff4199' : '3px solid transparent', cursor: 'pointer' }}>{label}</button>)}
        </div>;
      case 'account': {
        var accountFocused = isFocusedOnOptions && optionIndex === (macStore ? 1 : 0);
        var isPremium = user && user.subscription && user.subscription.tier === 'premium';
        // Premium upsell / management row — appears for ALL users (signed in
        // or not). Sits ABOVE the login/logout button so it's the first thing
        // the user sees when opening the Account tab.
        var premiumRow = macStore ? <button data-testid="settings-account-listening" onClick={() => setLocation('/premium-upgrade')} style={{ width: '100%', padding: 24, fontSize: 24, color: '#fff', border: isFocusedOnOptions && optionIndex === 0 ? '3px solid #ff4199' : '3px solid #555', borderRadius: 16, background: '#252525', textAlign: 'left', cursor: 'pointer' }}>Account &amp; Listening · Restore Existing Purchases</button> : (
          <div
            style={{
              ...optionRowBase,
              backgroundColor: 'rgba(255,65,153,0.08)',
              boxShadow: 'none',
              border: '1px solid rgba(255,65,153,0.35)',
              marginBottom: '12px',
              cursor: 'pointer',
            }}
            onClick={function() {
              // Premium users → Manage subscription. Free users → Upgrade.
              setLocation(isPremium ? '/manage-subscription' : '/premium-upgrade');
            }}
            data-testid="button-upgrade-premium"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.5 7H22l-6 4.5 2.3 7L12 16.5 5.7 20.5 8 13.5 2 9h7.5z"
                stroke="#ff4199" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,65,153,0.25)" />
            </svg>
            <div style={{ flex: 1 }}>
              <p className="font-['Ubuntu',Helvetica]" style={{ ...optionTextStyle, color: '#ff4199', fontWeight: 700 }}>
                {isPremium
                  ? (t('manage_subscription_title_premium') || 'Manage Premium')
                  : (t('upgrade_to_premium') || 'Upgrade to Premium')}
              </p>
              {!isPremium && (
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.55)', margin: '4px 0 0 0' }}>
                  {t('premium_tagline') || 'Ad-free · High-quality streams'}
                </p>
              )}
              {isPremium && (
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.55)', margin: '4px 0 0 0' }}>
                  {t('manage_subscription_hint') || 'Update payment · Change plan · Cancel'}
                </p>
              )}
            </div>
          </div>
        );

        if (isAuthenticated) {
          return (
            <div>
              {user && (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', height: '80px', paddingLeft: '24px', paddingRight: '24px', marginBottom: '16px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#ff4199', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 600, fontSize: '22px', color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                    {user.email && <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '16px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>{user.email}</p>}
                  </div>
                  {isPremium && (
                    <div data-testid="premium-badge-settings" style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '20px', backgroundColor: '#ff4199', boxShadow: '0 0 16px rgba(255,65,153,0.5)' }}>
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700, letterSpacing: 1 }}>PREMIUM</span>
                    </div>
                  )}
                </div>
              )}
              {premiumRow}
              <div
                style={{ ...optionRowBase, backgroundColor: accountFocused ? 'rgba(239,68,68,0.2)' : 'transparent', boxShadow: accountFocused ? '0 0 24px rgba(239,68,68,0.2)' : 'none', border: '1px solid rgba(239,68,68,0.3)' }}
                onClick={function() { logout(); }}
                data-testid="button-logout"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="16,17 21,12 16,7" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="21" y1="12" x2="9" y2="12" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="font-['Ubuntu',Helvetica]" style={{ ...optionTextStyle, color: '#ef4444' }}>
                  {t('logout') || 'Log Out'}
                </p>
              </div>
            </div>
          );
        } else {
          return (
            <div>
              {premiumRow}
              <div
                style={{ ...optionRowBase, backgroundColor: accountFocused ? '#ff4199' : 'transparent', boxShadow: accountFocused ? '0 0 24px rgba(255,65,153,0.3)' : 'none', border: '1px solid rgba(255,65,153,0.3)' }}
                onClick={function() { setLocation('/login'); }}
                data-testid="button-login"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="10,17 15,12 10,7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="15" y1="12" x2="3" y2="12" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="font-['Ubuntu',Helvetica]" style={optionTextStyle}>
                  {t('login') || 'Log In'}
                </p>
              </div>
            </div>
          );
        }
      }

      case 'cast': {
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingLeft: '24px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isConnected ? '#22c55e' : isAuthenticated ? '#eab308' : '#ef4444' }} />
              <p className="font-['Ubuntu',Helvetica]" style={{ fontSize: '22px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                {isConnected 
                  ? (t('cast_connected') || 'Connected to mobile app')
                  : isAuthenticated 
                    ? (t('cast_auto_info') || 'Cast is active. Play a station from your mobile app.')
                    : (t('cast_login_required') || 'Login required for Cast')}
              </p>
            </div>
            {isAuthenticated && (
              <p className="font-['Ubuntu',Helvetica]" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', margin: 0, paddingLeft: '24px', lineHeight: '1.6' }}>
                {t('cast_how') || 'Open megaradio app on your phone, select a station and tap Cast. It will automatically play here.'}
              </p>
            )}
            {!isAuthenticated && (
              <div
                style={{ ...optionRowBase, backgroundColor: isFocusedOnOptions && optionIndex === 0 ? '#ff4199' : 'transparent', boxShadow: isFocusedOnOptions && optionIndex === 0 ? '0 0 24px rgba(255,65,153,0.3)' : 'none', border: '1px solid rgba(255,65,153,0.3)', marginTop: '16px' }}
                onClick={function() { setLocation('/login'); }}
                data-testid="button-cast-login"
              >
                <p className="font-['Ubuntu',Helvetica]" style={{ ...optionTextStyle, color: isFocusedOnOptions && optionIndex === 0 ? '#fff' : '#ff4199' }}>
                  {t('login') || 'Login'}
                </p>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 w-[1920px] h-[1080px] overflow-hidden" data-testid="page-settings">
      <div className="absolute bg-[#0e0e0e] h-[1080px] left-0 top-0 w-[1920px]" />

      <div className="absolute h-[57px] left-[31px] top-[64px] w-[164.421px] z-50">
        <p className="absolute bottom-0 font-['Ubuntu',Helvetica] leading-normal left-[18.67%] not-italic right-0 text-[27.029px] text-white top-[46.16%] whitespace-pre-wrap">
          <span className="font-bold">mega</span>radio
        </p>
        <div className="absolute bottom-[2.84%] left-0 right-[65.2%] top-0">
          <img alt="" className="block max-w-none w-full h-full" src={assetPath("images/path-8.svg")} />
        </div>
      </div>

      <Sidebar activePage="settings" isFocused={helpFocused ? () => false : isFocused} getFocusClasses={getFocusClasses} isHelpFocused={helpFocused} />

      <p className="absolute font-['Ubuntu',Helvetica] font-bold leading-normal left-[236px] not-italic text-[36px] text-white top-[64px] z-10" data-testid="text-settings-title">
        {t('settings') || 'Settings'}
      </p>

      <div data-testid="settings-content" style={{ position: 'absolute', left: TV_LAYOUT.contentLeft, right: TV_LAYOUT.contentRight, top: '140px', height: '900px', zIndex: 10, display: 'flex', gap: 0 }}>

        <div style={{ flexShrink: 0, width: '420px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '24px' }}>
            {categories.map((cat, index) => {
              const isCatFocused = focusSection === 'categories' && categoryIndex === index;
              const isActive = categoryIndex === index;
              return (
                <div
                  key={cat}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '20px',
                    height: '80px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    backgroundColor: isCatFocused ? '#ff4199' : isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    boxShadow: isCatFocused ? '0 0 30px rgba(255,65,153,0.25)' : 'none'
                  }}
                  onClick={() => { setCategoryIndex(index); setFocusSection('options'); setOptionIndex(0); }}
                  data-testid={`category-${cat}`}
                >
                  <span style={{ flexShrink: 0, width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CategoryIcon type={cat} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <p
                      className="font-['Ubuntu',Helvetica]"
                      style={{
                        fontWeight: 600,
                        fontSize: '22px',
                        color: isCatFocused || isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: 0
                      }}
                    >
                      {getCategoryLabel(cat)}
                    </p>
                    {!isCatFocused && (
                      <p
                        className="font-['Ubuntu',Helvetica]"
                        style={{
                          fontWeight: 400,
                          fontSize: '16px',
                          color: 'rgba(255,255,255,0.35)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          margin: 0
                        }}
                      >
                        {cat === 'language' ? selectedLang.label
                          : cat === 'keyboard' ? selectedKb.label
                          : cat === 'playback' ? playAtStartLabels[playAtStart]
                          : cat === 'timer' ? (sleepTimerMinutes !== null ? sleepTimerLabels[String(sleepTimerMinutes)] : (t('sleep_timer_off') || 'Off'))
                          : cat === 'accessibility' ? (highContrast || largeText ? (
                              [highContrast && (t('high_contrast') || 'High Contrast'), largeText && (t('large_text') || 'Large Text')].filter(Boolean).join(', ')
                            ) : (t('settings_none') || 'None'))
                          : cat === 'cast' ? (isConnected ? (t('cast_connected') || 'Connected') : isAuthenticated ? (t('cast_waiting') || 'Waiting...') : (t('cast_not_connected') || 'Not Connected'))
                          : ''
                        }
                      </p>
                    )}
                  </div>
                  {isActive && !isCatFocused && (
                    <div style={{ width: '4px', height: '40px', borderRadius: '9999px', backgroundColor: '#ff4199', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '40px', paddingLeft: '24px', paddingRight: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {!isPremium && !macStore && (
              <button
                onClick={() => setLocation('/premium-upgrade')}
                onMouseEnter={() => setFocusSection('premium')}
                data-testid="settings-go-premium-btn"
                style={{
                  width: '100%',
                  height: '64px',
                  borderRadius: '32px',
                  border: focusSection === 'premium' ? '3px solid #fff' : 'none',
                  background: 'linear-gradient(135deg, #FF4199 0%, #AD00FF 100%)',
                  color: '#fff',
                  fontFamily: "'Ubuntu', sans-serif",
                  fontSize: '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: focusSection === 'premium'
                    ? '0 12px 40px rgba(255,65,153,0.85)'
                    : '0 8px 32px rgba(255,65,153,0.45)',
                  transform: focusSection === 'premium' ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border 0.15s',
                }}
              >
                <span style={{ fontSize: '22px' }}>⭐</span>
                Go Premium
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
              <img alt="" style={{ width: '36px', height: '36px' }} src={assetPath("images/path-8.svg")} />
              <div>
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 700, fontSize: '18px', color: '#ffffff', margin: 0 }}>
                  <span style={{ fontWeight: 700 }}>mega</span><span style={{ fontWeight: 300 }}>radio</span>
                </p>
                <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.3)', margin: 0 }} data-testid="text-app-version">
                  {(() => {
                    const src = (typeof window !== 'undefined' && (window as unknown as { __MR_BOOT_SRC__?: string }).__MR_BOOT_SRC__) === 'cdn' ? 'C' : 'L';
                    const build = (import.meta as any).env?.VITE_APP_VERSION;
                    return macStore ? 'Version ' + (build || '1.0.3') : 'Version 3.0 · ' + src + (build ? ' (' + build + ')' : '');
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.06)', flexShrink: 0, marginLeft: '8px', marginRight: '8px' }} />

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, paddingLeft: '32px', display: 'flex', flexDirection: 'column' }}>
          <div data-testid="settings-options-heading" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', marginBottom: '24px', minHeight: '48px', flexShrink: 0 }}>
            <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 700, fontSize: '28px', color: '#ffffff', margin: 0, maxWidth: '50%' }}>
              {getCategoryLabel(categories[categoryIndex])}
            </p>
            <div style={{ height: '1px', flex: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <p className="font-['Ubuntu',Helvetica]" style={{ fontWeight: 400, fontSize: '18px', color: 'rgba(255,255,255,0.35)', minWidth: 0, maxWidth: '50%', textAlign: 'right', margin: 0 }}>
              {renderCategoryDescription()}
            </p>
          </div>

          <div
            ref={optionListRef}
            data-testid="settings-options-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', paddingRight: '16px', flex: 1, minHeight: 0, scrollbarWidth: 'none' }}
          >
            {renderOptions()}
          </div>
        </div>
      </div>
    </div>
  );
};
