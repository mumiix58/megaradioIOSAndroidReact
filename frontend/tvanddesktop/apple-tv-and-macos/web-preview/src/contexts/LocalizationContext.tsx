import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { megaRadioApi } from '@/services/megaRadioApi';

interface LocalizationContextType {
  language: string;
  translations: Record<string, string>;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  isLoading: boolean;
  detectedCountry: string;
  detectedCountryCode: string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

// Language to country mapping
const LANGUAGE_TO_COUNTRY: Record<string, { name: string; code: string }> = {
  'en': { name: 'United States', code: 'US' },
  'de': { name: 'Germany', code: 'DE' },
  'fr': { name: 'France', code: 'FR' },
  'es': { name: 'Spain', code: 'ES' },
  'it': { name: 'Italy', code: 'IT' },
  'pt': { name: 'Portugal', code: 'PT' },
  'ru': { name: 'Russia', code: 'RU' },
  'ja': { name: 'Japan', code: 'JP' },
  'zh': { name: 'China', code: 'CN' },
  'ar': { name: 'Saudi Arabia', code: 'SA' },
  'tr': { name: 'Turkey', code: 'TR' },
  'pl': { name: 'Poland', code: 'PL' },
  'nl': { name: 'Netherlands', code: 'NL' },
  'sv': { name: 'Sweden', code: 'SE' },
  'no': { name: 'Norway', code: 'NO' },
  'da': { name: 'Denmark', code: 'DK' },
  'fi': { name: 'Finland', code: 'FI' },
  'cs': { name: 'Czech Republic', code: 'CZ' },
  'hu': { name: 'Hungary', code: 'HU' },
  'ro': { name: 'Romania', code: 'RO' },
  'el': { name: 'Greece', code: 'GR' },
  'th': { name: 'Thailand', code: 'TH' },
  'ko': { name: 'South Korea', code: 'KR' },
  'vi': { name: 'Vietnam', code: 'VN' },
  'id': { name: 'Indonesia', code: 'ID' },
  'ms': { name: 'Malaysia', code: 'MY' },
  'hi': { name: 'India', code: 'IN' },
  'bn': { name: 'Bangladesh', code: 'BD' },
  'ta': { name: 'India', code: 'IN' },
  'te': { name: 'India', code: 'IN' },
  'ur': { name: 'Pakistan', code: 'PK' },
  'fa': { name: 'Iran', code: 'IR' },
  'he': { name: 'Israel', code: 'IL' },
  'uk': { name: 'Ukraine', code: 'UA' },
  'bg': { name: 'Bulgaria', code: 'BG' },
  'sr': { name: 'Serbia', code: 'RS' },
  'hr': { name: 'Croatia', code: 'HR' },
  'sk': { name: 'Slovakia', code: 'SK' },
  'sl': { name: 'Slovenia', code: 'SI' },
  'et': { name: 'Estonia', code: 'EE' },
  'lv': { name: 'Latvia', code: 'LV' },
  'lt': { name: 'Lithuania', code: 'LT' },
  'is': { name: 'Iceland', code: 'IS' },
  'ga': { name: 'Ireland', code: 'IE' },
  'sq': { name: 'Albania', code: 'AL' },
  'mk': { name: 'North Macedonia', code: 'MK' },
  'am': { name: 'Ethiopia', code: 'ET' },
  'sw': { name: 'Kenya', code: 'KE' },
};

// Detect device language
function detectDeviceLanguage(): string {
  try {
    // Try Samsung Tizen API first
    if (window.webapis && window.webapis.tv) {
      const tizenLang = window.webapis.tv.info?.getLanguage?.();
      if (tizenLang) {
        return tizenLang.toLowerCase().substring(0, 2);
      }
    }

    // Try LG webOS API
    if (window.webOS && window.webOS.systemInfo) {
      const webOSLang = window.webOS.systemInfo.locale || window.webOS.systemInfo.language;
      if (webOSLang) {
        return webOSLang.toLowerCase().substring(0, 2);
      }
    }

    // Fallback to browser navigator
    const browserLang = navigator.language || navigator.languages?.[0] || 'en';
    return browserLang.toLowerCase().substring(0, 2);
  } catch (error) {
    return 'en';
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState('United States');
  const [detectedCountryCode, setDetectedCountryCode] = useState('US');

  // Initialize: Detect language and load translations
  useEffect(() => {
    const initializeLocalization = async () => {
      try {
        // Check localStorage for saved language
        const savedLang = localStorage.getItem('app_language');
        let langToUse = savedLang || detectDeviceLanguage();

        // Ensure we support this language
        const supportedLanguages = Object.keys(LANGUAGE_TO_COUNTRY);
        if (!supportedLanguages.includes(langToUse)) {
          langToUse = 'en';
        }

        setLanguageState(langToUse);

        // Set country based on language
        const countryInfo = LANGUAGE_TO_COUNTRY[langToUse] || LANGUAGE_TO_COUNTRY['en'];
        setDetectedCountry(countryInfo.name);
        setDetectedCountryCode(countryInfo.code);

        // Fetch translations from API
        const translationsData = await megaRadioApi.getTranslations(langToUse);
        
        // API returns translations directly OR in a "translations" property
        const translations = translationsData.translations || translationsData;
        
        if (translations && typeof translations === 'object') {
          setTranslations(translations);
        } else {
          setTranslations({});
        }
      } catch (error) {
        // Set default English translations as fallback
        setTranslations({});
      } finally {
        setIsLoading(false);
      }
    };

    initializeLocalization();
  }, []);

  // Change language function
  const setLanguage = async (lang: string) => {
    try {
      setIsLoading(true);
      
      // Update country based on new language
      const countryInfo = LANGUAGE_TO_COUNTRY[lang] || LANGUAGE_TO_COUNTRY['en'];
      setDetectedCountry(countryInfo.name);
      setDetectedCountryCode(countryInfo.code);

      // Fetch new translations
      const translationsData = await megaRadioApi.getTranslations(lang);
      
      // API returns translations directly OR in a "translations" property
      const translations = translationsData.translations || translationsData;
      setTranslations(translations);
      setLanguageState(lang);
      
      // Save to localStorage
      localStorage.setItem('app_language', lang);
    } catch (error) {
      // Failed to change language
    } finally {
      setIsLoading(false);
    }
  };

  // English fallback dictionary for common UI strings
  const ENGLISH_FALLBACKS: Record<string, string> = {
    // Navigation
    'nav_discover': 'Discover',
    'nav_genres': 'Genres',
    'nav_search': 'Search',
    'nav_favorites': 'Favorites',
    'nav_settings': 'Settings',
    'nav_country': 'Country',
    // Common UI
    'popular_genres': 'Popular Genres',
    'popular_stations': 'Popular Stations',
    'homepage_popular_stations': 'Popular Stations',
    'more_from': 'More From',
    'loading': 'Loading...',
    'loading_more_stations': 'Loading more stations...',
    'no_results': 'No results found',
    'search_placeholder': 'Search stations...',
    'now_playing': 'Now Playing',
    'station_info': 'Station Info',
    'similar_stations': 'Similar Stations',
    'add_to_favorites': 'Add to Favorites',
    'remove_from_favorites': 'Remove from Favorites',
    'play': 'Play',
    'pause': 'Pause',
    'stop': 'Stop',
    'back': 'Back',
    'next': 'Next',
    'previous': 'Previous',
    'settings': 'Settings',
    'language': 'Language',
    'country': 'Country',
    'auto_play': 'Auto Play',
    'about': 'About',
    'version': 'Version',
    'exit': 'Exit',
    'exit_app': 'Exit App',
    'exit_confirm': 'Are you sure you want to exit?',
    'yes': 'Yes',
    'no': 'No',
    'cancel': 'Cancel',
    'ok': 'OK',
    'error': 'Error',
    'retry': 'Retry',
    'tv_privacy_title': 'Privacy & Data',
    'tv_privacy_description': 'Both options are off by default. You can change them at any time. Listening works with both off.',
    'tv_diagnostics_label': 'Share diagnostics',
    'tv_diagnostics_desc': 'Share technical error codes and app versions to help fix startup and playback. No error messages, account details or stream addresses.',
    'tv_usage_label': 'Share usage analytics',
    'tv_usage_desc': 'Share counts of screens and playback actions with a random analytics identifier. Turning this off deletes that identifier. No search text, station names or account/hardware IDs.',
    'no_internet': 'No Internet Connection',
    'check_connection': 'Please check your network connection',
    'all': 'All',
    'stations': 'Stations',
    'genres': 'Genres',
    'favorites': 'Favorites',
    'no_favorites': 'No favorites yet',
    'add_favorites_hint': 'Add stations to your favorites to see them here',
  };

  // Translation function with fallback
  const t = (key: string): string => {
    // Return translation if exists from API
    if (translations[key]) {
      return translations[key];
    }
    
    // Check English fallback dictionary
    if (ENGLISH_FALLBACKS[key]) {
      return ENGLISH_FALLBACKS[key];
    }
    
    // Last resort: Convert snake_case to Title Case
    const fallback = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
      .replace(/^Auth\s/, '')
      .replace(/^Homepage\s/, '')
      .replace(/^Profile\sNav\s/, '');
    
    return fallback;
  };

  return (
    <LocalizationContext.Provider 
      value={{ 
        language, 
        translations, 
        setLanguage, 
        t, 
        isLoading,
        detectedCountry,
        detectedCountryCode
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }
  return context;
}

// Type declarations for Samsung/LG APIs
declare global {
  interface Window {
    webapis?: {
      tv?: {
        info?: {
          getLanguage?: () => string;
        };
      };
    };
    webOS?: {
      systemInfo?: {
        locale?: string;
        language?: string;
      };
    };
  }
}
