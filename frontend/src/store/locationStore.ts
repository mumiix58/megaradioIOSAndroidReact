import api from '../services/api';
import { isGlobalCountry } from '../utils/countryScope';
import { create } from 'zustand';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for persisted country selection
const COUNTRY_KEY = '@megaradio_selected_country';

// Country name to ISO code mapping
const COUNTRY_CODE_MAP: Record<string, string> = {
  'Turkey': 'TR', 'Türkiye': 'TR',
  'Germany': 'DE', 'Deutschland': 'DE',
  'Austria': 'AT', 'Österreich': 'AT',
  'Switzerland': 'CH', 'Schweiz': 'CH',
  'France': 'FR',
  'Spain': 'ES', 'España': 'ES',
  'Italy': 'IT', 'Italia': 'IT',
  'Netherlands': 'NL', 'Nederland': 'NL',
  'Belgium': 'BE', 'België': 'BE',
  'Poland': 'PL', 'Polska': 'PL',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Česko': 'CZ',
  'Russia': 'RU', 'Россия': 'RU',
  'Ukraine': 'UA', 'Україна': 'UA',
  'Greece': 'GR', 'Ελλάδα': 'GR',
  'Japan': 'JP', '日本': 'JP',
  'China': 'CN', '中国': 'CN',
  'South Korea': 'KR', '대한민국': 'KR',
  'Brazil': 'BR', 'Brasil': 'BR',
  'Portugal': 'PT',
  'Romania': 'RO', 'România': 'RO',
  'Hungary': 'HU', 'Magyarország': 'HU',
  'Sweden': 'SE', 'Sverige': 'SE',
  'Norway': 'NO', 'Norge': 'NO',
  'Denmark': 'DK', 'Danmark': 'DK',
  'Finland': 'FI', 'Suomi': 'FI',
  'Croatia': 'HR', 'Hrvatska': 'HR',
  'Serbia': 'RS', 'Србија': 'RS',
  'Bulgaria': 'BG', 'България': 'BG',
  'Slovakia': 'SK', 'Slovensko': 'SK',
  'Slovenia': 'SI', 'Slovenija': 'SI',
  'United States': 'US', 'USA': 'US',
  'United Kingdom': 'GB', 'UK': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Mexico': 'MX', 'México': 'MX',
  'Argentina': 'AR',
  'Colombia': 'CO',
  'Chile': 'CL',
  'Peru': 'PE', 'Perú': 'PE',
  'India': 'IN',
  'Indonesia': 'ID',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Philippines': 'PH',
  'Malaysia': 'MY',
  'Singapore': 'SG',
  'Egypt': 'EG',
  'South Africa': 'ZA',
  'Nigeria': 'NG',
  'Kenya': 'KE',
  'Morocco': 'MA',
  'Algeria': 'DZ',
  'Tunisia': 'TN',
  'Israel': 'IL',
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE', 'UAE': 'AE',
  'Iraq': 'IQ',
  'Iran': 'IR',
  'Pakistan': 'PK',
  'Bangladesh': 'BD',
  'New Zealand': 'NZ',
  'Ireland': 'IE',
  'Iceland': 'IS',
  'Estonia': 'EE',
  'Latvia': 'LV',
  'Lithuania': 'LT',
  'Belarus': 'BY',
  'Moldova': 'MD',
  'Albania': 'AL',
  'North Macedonia': 'MK',
  'Montenegro': 'ME',
  'Bosnia and Herzegovina': 'BA',
  'Kosovo': 'XK',
  'Cyprus': 'CY',
  'Malta': 'MT',
  'Luxembourg': 'LU',
  'Liechtenstein': 'LI',
  'Monaco': 'MC',
  'Andorra': 'AD',
  'San Marino': 'SM',
  'Vatican City': 'VA',
};

// English to Native name mapping for API calls
const COUNTRY_NATIVE_MAP: Record<string, string> = {
  'Turkey': 'Türkiye',
  'Germany': 'Deutschland',
  'Austria': 'Österreich',
  'Switzerland': 'Schweiz',
  'France': 'France',
  'Spain': 'España',
  'Italy': 'Italia',
  'Netherlands': 'Nederland',
  'Belgium': 'België',
  'Poland': 'Polska',
  'Czech Republic': 'Česko',
  'Czechia': 'Česko',
  'Russia': 'Россия',
  'Ukraine': 'Україна',
  'Greece': 'Ελλάδα',
  'Japan': '日本',
  'China': '中国',
  'South Korea': '대한민국',
  'Brazil': 'Brasil',
  'Portugal': 'Portugal',
  'Romania': 'România',
  'Hungary': 'Magyarország',
  'Sweden': 'Sverige',
  'Norway': 'Norge',
  'Denmark': 'Danmark',
  'Finland': 'Suomi',
  'Croatia': 'Hrvatska',
  'Serbia': 'Србија',
  'Bulgaria': 'България',
  'Slovakia': 'Slovensko',
  'Slovenia': 'Slovenija',
};

// Native to English name mapping (reverse)
const COUNTRY_ENGLISH_MAP: Record<string, string> = Object.entries(COUNTRY_NATIVE_MAP).reduce(
  (acc, [eng, native]) => ({ ...acc, [native]: eng }),
  {}
);

interface LocationState {
  countryCode: string | null; // e.g., "AT" for Austria
  country: string | null;     // Native name e.g., "Österreich" (for /api/stations)
  countryEnglish: string | null; // English name e.g., "Austria" (for /api/stations/popular)
  nearbyCountryEnglish: string | null;
  nearbyCountryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  permission: 'unknown'|'undetermined'|'denied'|'granted';
  canAskAgain: boolean;
  loading: boolean;
  error: string | null;
  isManuallySet: boolean; // Track if country was manually selected
  isLoaded: boolean; // Track if initial country data has been loaded (from storage or detection)
  loadStoredCountry: () => Promise<void>;
  fetchLocation: (options?:{requestPermission?:boolean}) => Promise<void>;
  detectCountryFromIp: () => Promise<void>;
  setCountryManual: (
    country: string,
    overrides?: { code?: string | null; englishName?: string; nativeName?: string }
  ) => Promise<void>;
  getCountryForApi: (apiType: 'popular' | 'stations') => string | undefined;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  countryCode: null,
  country: null,
  countryEnglish: null,
  nearbyCountryEnglish: null,
  nearbyCountryCode: null,
  latitude: null,
  longitude: null,
  permission: 'unknown',
  canAskAgain: true,
  loading: false,
  error: null,
  isManuallySet: false,
  isLoaded: false, // Initially not loaded

  // Load stored country from AsyncStorage on app startup
  loadStoredCountry: async () => {
    try {
      const storedData = await AsyncStorage.getItem(COUNTRY_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const { country, countryCode, countryEnglish, isManuallySet: wasManual } = parsed;
        console.log('[LocationStore] Loaded stored country:', country, countryCode, 'wasManual:', wasManual);
        set({
          country,
          countryCode,
          countryEnglish,
          // Only preserve isManuallySet if it was explicitly set by user picker
          isManuallySet: wasManual === true,
          isLoaded: true,
        });
      } else {
        // No stored country - mark as loaded for initial queries
        console.log('[LocationStore] No stored country found, marking as loaded for initial queries');
        set({ isLoaded: true });
      }
    } catch (error) {
      console.error('[LocationStore] Failed to load stored country:', error);
      set({ isLoaded: true });
    } finally {
      // IP detection must not hold the splash or ask for GPS permission.
      void get().detectCountryFromIp();
    }
  },

  detectCountryFromIp: async () => {
    try {
      const response = await api.get('/api/location', { timeout: 3000 });
      const detected = response.data?.location;
      const current = get();
      // GPS wins over a late IP response; browsing country stays independent.
      if ((current.latitude !== null && current.longitude !== null) || !detected?.detected || !detected.country || isGlobalCountry(detected.country)) return;
      const englishName = COUNTRY_ENGLISH_MAP[detected.country] || detected.country;
      set({ nearbyCountryEnglish: englishName, nearbyCountryCode: detected.countryCode || COUNTRY_CODE_MAP[englishName] || null });
      if (current.isManuallySet) return;
      set({ countryEnglish: englishName, country: COUNTRY_NATIVE_MAP[englishName] || englishName, countryCode: detected.countryCode || COUNTRY_CODE_MAP[englishName] || null });
      // IP location is approximate. Do not populate GPS coordinates from it.
    } catch {
      // Keep a stored country (or Global) when IP detection is unavailable.
    }
  },

  fetchLocation: async ({requestPermission=false}={}) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      // Startup/focus only reads permission. A prompt requires an explicit tap.
      let permission=await Location.getForegroundPermissionsAsync();
      if(permission.status!=='granted'&&requestPermission&&permission.canAskAgain!==false){
        permission=await Location.requestForegroundPermissionsAsync();
      }
      const granted=permission.status==='granted';
      set({permission:permission.status,canAskAgain:permission.canAskAgain!==false,...(!granted?{latitude:null,longitude:null}:{})});
      if(!granted){set({loading:false,error:null,isLoaded:true});return;}
      if(Location.hasServicesEnabledAsync&&!(await Location.hasServicesEnabledAsync())){
        set({loading:false,error:'services-disabled',isLoaded:true});return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const { latitude, longitude } = location.coords;
      // ALWAYS set GPS coordinates (used for "Stations Near You" regardless of manual country)
      set({ latitude, longitude });

      // Detect the physical country independently of the browsing selection.
      let geo:Location.LocationGeocodedAddress|undefined;
      try{[geo]=await Location.reverseGeocodeAsync({latitude,longitude});}
      catch{ /* Web geocoding may be unavailable; valid GPS still drives nearby. */ }

      if (geo) {
        const countryName = geo.country || null;
        const nativeName = COUNTRY_NATIVE_MAP[countryName || ''] || countryName;
        const code = geo.isoCountryCode || COUNTRY_CODE_MAP[countryName || ''] || null;
        set({ nearbyCountryEnglish: COUNTRY_ENGLISH_MAP[countryName || ''] || countryName, nearbyCountryCode: code });
        if (get().isManuallySet) { set({ loading: false, isLoaded: true }); return; }
        console.log('[LocationStore] Location detected:', countryName, nativeName, code);
        set({
          countryCode: code,
          country: nativeName,
          countryEnglish: countryName,
          loading: false,
          isLoaded: true,
        });
        // Save GPS-detected country to storage (with isManuallySet: false)
        try {
          await AsyncStorage.setItem(COUNTRY_KEY, JSON.stringify({
            country: nativeName,
            countryCode: code,
            countryEnglish: countryName,
            isManuallySet: false,
          }));
        } catch (e) {
          console.log('[LocationStore] Failed to save GPS country:', e);
        }
      } else {
        console.log('[LocationStore] No geo data, setting isLoaded');
        set({ loading: false, isLoaded: true });
      }
    } catch (err) {
      console.log('[Location] Error:', err);
      set({ loading: false, error: 'Failed to get location', isLoaded: true });
    }
  },

  setCountryManual: async (
    countryName: string,
    overrides?: { code?: string | null; englishName?: string; nativeName?: string }
  ) => {
    // Prefer overrides (e.g. API returns full code) over local maps for 215+ countries
    const englishName =
      overrides?.englishName ||
      COUNTRY_ENGLISH_MAP[countryName] ||
      countryName;
    const nativeName =
      overrides?.nativeName ||
      COUNTRY_NATIVE_MAP[countryName] ||
      COUNTRY_NATIVE_MAP[englishName] ||
      countryName;

    // Global is a scope, never an ISO country flag.
    const countryCode = isGlobalCountry(englishName) ? null :
      (overrides?.code ?? null) ||
      COUNTRY_CODE_MAP[countryName] ||
      COUNTRY_CODE_MAP[englishName] ||
      COUNTRY_CODE_MAP[nativeName] ||
      null;

    console.log('[LocationStore] setCountryManual:', { countryName, englishName, nativeName, countryCode });

    // Update state
    set({
      country: nativeName,
      countryEnglish: englishName,
      countryCode: countryCode,
      loading: false,
      error: null,
      isManuallySet: true,
    });
    
    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(COUNTRY_KEY, JSON.stringify({
        country: nativeName,
        countryCode: countryCode,
        countryEnglish: englishName,
        isManuallySet: true,
      }));
      console.log('[LocationStore] Country saved to storage');
    } catch (error) {
      console.error('[LocationStore] Failed to save country:', error);
    }
  },
  
  // Helper to get correct country name for different API endpoints
  getCountryForApi: (apiType: 'popular' | 'stations') => {
    const state = get();
    if (isGlobalCountry(state.countryEnglish) || isGlobalCountry(state.country)) return undefined;
    if (apiType === 'popular') {
      // Popular API expects English name
      return state.countryEnglish || state.country || undefined;
    }
    // Stations API expects native name
    return state.country || undefined;
  },
}));

export default useLocationStore;
