// CarPlay & Android Auto Service
// Handles connection events and template management for in-car displays

import { Platform, NativeModules } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import i18n, { addLanguageChangeListener } from './i18nService';
import { getStationLogoUrl as centralGetStationLogoUrl, DEFAULT_STATION_LOGO_URL, DEFAULT_STATION_LOGO_NATIVE_SOURCE } from '../utils/stationLogoHelper';
import { getCarPlayImagePath, cacheStationImages } from './carPlayImageCache';

// Native module for cache bridge (iOS only)
const CarPlayCacheModule = NativeModules.CarPlayCacheModule;

// Helper to save stations to native cache (iOS only)
const saveToNativeCache = (stations: any[], key: string = 'popular') => {
  if (Platform.OS === 'ios' && CarPlayCacheModule?.saveStations) {
    try {
      // Convert to simple format for native cache
      const cacheData = stations.map(s => ({
        id: s._id || s.id,
        name: s.name,
        country: s.country || '',
        favicon: s.favicon || s.logo || '',
        url: s.url || s.streamUrl || '',
        genre: s.genre || s.tags?.split(',')[0] || '',
      }));
      CarPlayCacheModule.saveStations(cacheData, key);
      console.log(`[CarPlay] Saved ${cacheData.length} stations to native cache for key: ${key}`);
    } catch (e) {
      console.log('[CarPlay] Native cache save failed (module may not be available):', e);
    }
  }
};

// LOCAL ASSETS for CarPlay - NO backend dependency
// These ensure CarPlay works even when offline
const LOCAL_FALLBACK_LOGO = DEFAULT_STATION_LOGO_NATIVE_SOURCE;

// Genre-specific icons for CarPlay
const GENRE_ICONS: { [key: string]: any } = {
  pop: require('../../assets/images/genres/genre-pop.png'),
  rock: require('../../assets/images/genres/genre-rock.png'),
  jazz: require('../../assets/images/genres/genre-jazz.png'),
  classical: require('../../assets/images/genres/genre-classical.png'),
  dance: require('../../assets/images/genres/genre-dance.png'),
  electronic: require('../../assets/images/genres/genre-dance.png'),
  hiphop: require('../../assets/images/genres/genre-hiphop.png'),
  'hip-hop': require('../../assets/images/genres/genre-hiphop.png'),
  rap: require('../../assets/images/genres/genre-hiphop.png'),
  country: require('../../assets/images/genres/genre-country.png'),
  news: require('../../assets/images/genres/genre-news.png'),
  talk: require('../../assets/images/genres/genre-news.png'),
  sports: require('../../assets/images/genres/genre-sports.png'),
  world: require('../../assets/images/genres/genre-world.png'),
  rnb: require('../../assets/images/genres/genre-rnb.png'),
  'r&b': require('../../assets/images/genres/genre-rnb.png'),
  soul: require('../../assets/images/genres/genre-rnb.png'),
  metal: require('../../assets/images/genres/genre-metal.png'),
  blues: require('../../assets/images/genres/genre-blues.png'),
  default: require('../../assets/images/genres/genre-default.png'),
};

// Get genre icon by name (case-insensitive, with fallback)
const getGenreIcon = (genreName: string): any => {
  const key = genreName.toLowerCase().replace(/[\s_]/g, '-').replace(/[^a-z-]/g, '');
  return GENRE_ICONS[key] || GENRE_ICONS.default;
};

// URL fallback for when local asset can't be used (legacy compatibility)
const FALLBACK_LOGO_URL = 'https://themegaradio.com/logo.png';

// Helper function to get translated CarPlay strings - always use current i18n state
const t = (key: string, fallback: string): string => {
  try {
    const translation = i18n.t(key);
    // If translation equals key, it means no translation found - use fallback
    return translation !== key ? translation : fallback;
  } catch {
    return fallback;
  }
};

// Track if we need to refresh templates when language/country changes
let needsTemplateRefresh = false;
let languageListenerUnsubscribe: (() => void) | null = null;

// Only import CarPlay on native platforms
let CarPlay: any = null;
let ListTemplate: any = null;
let TabBarTemplate: any = null;
let NowPlayingTemplate: any = null;
let GridTemplate: any = null;
let SearchTemplate: any = null;
let VoiceControlTemplate: any = null;

// Track if we've already registered handlers (prevent duplicates)
let handlersRegistered = false;

// Queue for pending operations when CarPlay connects before service is initialized
let pendingConnection = false;

// Cold-start retry mechanism
let coldStartRetryCount = 0;
const MAX_COLD_START_RETRIES = 10; // Reduced - less aggressive
const COLD_START_RETRY_INTERVAL = 2000; // 2 seconds - less aggressive
let coldStartRetryTimer: ReturnType<typeof setInterval> | null = null;

// Mutex to prevent concurrent template creation (crash fix)
let isCreatingTemplate = false;
// Flag to indicate callbacks were updated while template was being created
let pendingCallbackRefresh = false;

// INFINITE LOOP FIX: Debounce onConnect events
// Native Android Auto can fire didConnect many times in rapid succession
let lastConnectHandledAt = 0;
const CONNECT_DEBOUNCE_MS = 3000; // Ignore duplicate connects within 3 seconds
let connectionFullyHandled = false; // True after first successful template creation

// Store references to registered callbacks so we can unregister them
let registeredOnConnectCallback: ((window?: any) => void) | null = null;
let registeredOnDisconnectCallback: (() => void) | null = null;
let earlyOnConnectCallback: ((window?: any) => void) | null = null;
let earlyOnDisconnectCallback: (() => void) | null = null;

if (Platform.OS !== 'web') {
  try {
    const carplayModule = require('@g4rb4g3/react-native-carplay');
    CarPlay = carplayModule.CarPlay;
    ListTemplate = carplayModule.ListTemplate;
    TabBarTemplate = carplayModule.TabBarTemplate;
    NowPlayingTemplate = carplayModule.NowPlayingTemplate;
    GridTemplate = carplayModule.GridTemplate;
    SearchTemplate = carplayModule.SearchTemplate;
    VoiceControlTemplate = carplayModule.VoiceControlTemplate;
    
    
    // CRITICAL: Register handlers IMMEDIATELY when module loads
    // This ensures we catch connection events even if they fire before initialize()
    if (CarPlay && !handlersRegistered) {
      try {
        
        // INFINITE LOOP FIX: Store callback references for later cleanup
        earlyOnConnectCallback = () => {
          // DEBOUNCE: Ignore rapid-fire didConnect events
          const now = Date.now();
          if (now - lastConnectHandledAt < CONNECT_DEBOUNCE_MS) {
            return; // Skip duplicate connect within debounce window
          }
          lastConnectHandledAt = now;
          
          pendingConnection = true;
        };
        
        earlyOnDisconnectCallback = () => {
          pendingConnection = false;
          connectionFullyHandled = false;
          lastConnectHandledAt = 0; // Reset debounce on disconnect
        };
        
        CarPlay.registerOnConnect(earlyOnConnectCallback);
        CarPlay.registerOnDisconnect(earlyOnDisconnectCallback);
        
        // Check if already connected at module load time
        // NOTE: Only check the property, do NOT call checkForConnection() on Android
        try {
          if (CarPlay.connected) {
            pendingConnection = true;
          }
        } catch (connErr) {
          console.log('[CarPlayService] Error checking CarPlay.connected:', connErr);
        }
        
        handlersRegistered = true;
      } catch (handlerErr: any) {
        console.log('[CarPlayService] Error registering CarPlay handlers:', handlerErr);
      }
    }
  } catch (e: any) {
    console.log('[CarPlayService] CarPlay module not available:', e);
  }
}

// Types
interface Station {
  _id: string;
  name: string;
  logo?: string;
  favicon?: string;
  country?: string;
  tags?: string;
  url: string;
  url_resolved?: string;
}

interface CarPlayServiceType {
  isConnected: boolean;
  initialize: (
    playStation: (station: Station) => Promise<void>,
    getStations: () => Promise<Station[]>,
    getFavorites: () => Promise<Station[]>,
    getRecentlyPlayed: () => Promise<Station[]>,
    getGenres: () => Promise<{ name: string; count: number }[]>,
    getStationsByGenre: (genre: string) => Promise<Station[]>,
    searchStations?: (query: string) => Promise<Station[]>,
    toggleFavorite?: (station: Station) => Promise<void>,
    isFavorite?: (stationId: string) => boolean,
    getNextStation?: () => Promise<Station | null>,
    getPreviousStation?: () => Promise<Station | null>
  ) => void;
  updateNowPlaying: (station: Station, songTitle?: string, artistName?: string) => void;
  disconnect: () => void;
  openSearch?: () => void;
  refreshTemplates?: () => Promise<void>;
  refreshFavorites?: () => Promise<void>;
  refreshRecentlyPlayed?: () => Promise<void>;
}

// Global state
let isCarPlayConnected = false;
let connectionGeneration = 0;
let activeRootTemplates: any[] = [];
const sessionIsCurrent = (generation: number) =>
  isCarPlayConnected && generation === connectionGeneration;
const destroyTemplates = (templates: any[]) => templates.forEach(template => template?.destroy?.());
let playStationCallback: ((station: Station) => Promise<void>) | null = null;
let getStationsCallback: (() => Promise<Station[]>) | null = null;
let getFavoritesCallback: (() => Promise<Station[]>) | null = null;
let getRecentlyPlayedCallback: (() => Promise<Station[]>) | null = null;
let getGenresCallback: (() => Promise<{ name: string; count: number }[]>) | null = null;
let getStationsByGenreCallback: ((genre: string) => Promise<Station[]>) | null = null;
let searchStationsCallback: ((query: string) => Promise<Station[]>) | null = null;
let toggleFavoriteCallback: ((station: Station) => Promise<void>) | null = null;
let isFavoriteCallback: ((stationId: string) => boolean) | null = null;
let getNextStationCallback: (() => Promise<Station | null>) | null = null;
let getPreviousStationCallback: (() => Promise<Station | null>) | null = null;
// Track the currently playing station for NowPlaying button callbacks
let currentNowPlayingStation: Station | null = null;

// Helper to get station artwork as ImageSourcePropType
// For CarPlay: Downloads and caches image locally, returns local file path
// CarPlay does NOT support remote URLs!
const getStationImage = async (station: Station): Promise<{ uri: string } | null> => {
  try {
    // Try to get cached local path first
    const localPath = await getCarPlayImagePath(station as any);
    
    if (localPath && localPath.length > 0) {
      return { uri: localPath };
    }
    
    // Fallback: return null (template will show without image)
    // This is better than crashing CarPlay with remote URL
    return null;
  } catch (error) {
    console.error('[CarPlayService] getStationImage error:', error);
    return null;
  }
};

// Pre-download images for a list of stations and return a map of stationId -> local image source
// CRITICAL: CPListItem image is IMMUTABLE after creation on iOS!
// We MUST download images BEFORE creating template items, not after.
const preloadStationImages = async (stations: Station[]): Promise<Map<string, any>> => {
  const imageMap = new Map<string, any>();
  
  try {
    // Use batch download from carPlayImageCache
    const cachedPaths = await cacheStationImages(stations as any[]);
    
    // Convert local paths to ImageSourcePropType
    cachedPaths.forEach((localPath, stationId) => {
      if (localPath && localPath.length > 0) {
        imageMap.set(stationId, { uri: localPath });
      }
    });
    
    console.log(`[CarPlay] Pre-loaded ${imageMap.size}/${stations.length} station images`);
  } catch (error) {
    console.error('[CarPlay] Error pre-loading station images:', error);
  }
  
  return imageMap;
};

// Get the correct image for a station: pre-downloaded local image or fallback
const getStationImageFromMap = (station: Station, imageMap: Map<string, any>): any => {
  const id = station._id || (station as any).id || '';
  if (imageMap.has(id)) {
    return imageMap.get(id);
  }
  return LOCAL_FALLBACK_LOGO;
};

// Synchronous helper for immediate use - delegates to centralized stationLogoHelper
const getStationImageSync = (station: Station): { uri: string } => {
  const url = centralGetStationLogoUrl(station);
  return { uri: url || FALLBACK_LOGO_URL };
};

// Legacy helper (string version) for backward compatibility and CarPlay imgUrl
const getArtworkUrl = (station: Station): string => {
  return centralGetStationLogoUrl(station) || FALLBACK_LOGO_URL;
};

// Create Favorites List Template
const createFavoritesTemplate = async (): Promise<any> => {
  const generation = connectionGeneration;
  
  if (!ListTemplate || !getFavoritesCallback) {
    return null;
  }
  
  try {
    
    // COLD START FIX: Increased timeout to 10s for cold start scenarios
    // JS bundle initialization and API calls can take longer on first launch
    const TIMEOUT_MS = 10000;
    const timeoutPromise = new Promise<Station[]>((resolve) => 
      setTimeout(() => {
        console.log('[CarPlay] Favorites timeout - returning empty');
        resolve([]);
      }, TIMEOUT_MS)
    );
    
    const favorites = await Promise.race([getFavoritesCallback(), timeoutPromise]);
    if (!sessionIsCurrent(generation)) return null;
    
    // Build items with imgUrl for async native image loading
    // Native iOS downloads images asynchronously via imgUrl during item creation
    const items = favorites.map(station => {
      const imgUrl = getArtworkUrl(station);
      return {
        text: station.name,
        detailText: station.country || station.tags?.split(',')[0] || 'Radio',
        image: LOCAL_FALLBACK_LOGO,
        imgUrl: imgUrl,
      };
    });
    
    const template = new ListTemplate({
      title: t('carplay_favorites', 'Favorites'),
      tabTitle: t('carplay_favorites', 'Favorites'),
      tabSystemImageName: 'heart.fill',
      sections: [{
        header: `${t('carplay_favorite_stations', 'Favorite Stations')} (${favorites.length})`,
        items,
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const station = favorites[index];
        if (station && playStationCallback) {
          console.log('[CarPlay] Playing favorite:', station.name);
          try {
            await playStationCallback(station);
            showNowPlayingTemplate(station);
          } catch (e: any) {
          }
        }
      },
    });
    
    return template;
  } catch (error: any) {
    console.error('[CarPlay] Error creating favorites template:', error);
    return null;
  }
};

// Create Recently Played List Template
const createRecentlyPlayedTemplate = async (): Promise<any> => {
  const generation = connectionGeneration;
  
  if (!ListTemplate || !getRecentlyPlayedCallback) {
    return null;
  }
  
  try {
    
    // COLD START FIX: Increased timeout to 10s for cold start scenarios
    const TIMEOUT_MS = 10000;
    const timeoutPromise = new Promise<Station[]>((resolve) => 
      setTimeout(() => {
        console.log('[CarPlay] RecentlyPlayed timeout - returning empty');
        resolve([]);
      }, TIMEOUT_MS)
    );
    
    const recentStations = await Promise.race([getRecentlyPlayedCallback(), timeoutPromise]);
    if (!sessionIsCurrent(generation)) return null;
    
    // Use ListTemplate for Recently Played - supports imgUrl for remote logos
    // (GridTemplate does NOT support imgUrl, only local images)
    console.log('[CarPlay] Using ListTemplate for Recently Played (Zuletzt gespielt)');
    
    const stationsSlice = recentStations.slice(0, 24);
    const items = stationsSlice.map(station => {
      const imgUrl = getArtworkUrl(station);
      return {
        text: station.name,
        detailText: station.country || station.tags?.split(',')[0] || 'Radio',
        image: LOCAL_FALLBACK_LOGO,
        imgUrl: imgUrl,
      };
    });
    
    const template = new ListTemplate({
      title: t('carplay_recently_played', 'Zuletzt gespielt'),
      tabTitle: t('carplay_recently_played', 'Recently Played'),
      tabSystemImageName: 'clock.fill',
      sections: [{
        header: `${t('carplay_recent_stations', 'Recent Stations')} (${stationsSlice.length})`,
        items,
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const station = stationsSlice[index];
        if (station && playStationCallback) {
          console.log('[CarPlay] Playing recent:', station.name);
          try {
            await playStationCallback(station);
            showNowPlayingTemplate(station);
          } catch (e: any) {
          }
        }
      },
    });
    
    return template;
  } catch (error: any) {
    console.error('[CarPlay] Error creating recently played template:', error);
    return null;
  }
};

// Create Genres Grid Template (40 genres in grid layout)
const createGenresTemplate = async (): Promise<any> => {
  const generation = connectionGeneration;
  
  // Try GridTemplate first, fallback to ListTemplate
  const TemplateClass = GridTemplate || ListTemplate;
  
  if (!TemplateClass || !getGenresCallback) {
    return null;
  }
  
  // SF Symbol mapping for CarPlay genre icons
  // These are native iOS system symbols that display properly in CarPlay
  const genreSFSymbols: Record<string, string> = {
    pop: 'star.fill',
    rock: 'bolt.fill',
    jazz: 'music.note.list',
    classical: 'leaf.fill',
    electronic: 'waveform.path',
    'hip-hop': 'mic.fill',
    hiphop: 'mic.fill',
    country: 'sun.max.fill',
    world: 'globe',
    news: 'newspaper.fill',
    talk: 'bubble.left.and.bubble.right.fill',
    sports: 'sportscourt.fill',
    oldies: 'clock.fill',
    alternative: 'flame.fill',
    reggae: 'leaf.fill',
    metal: 'guitars.fill',
    folk: 'cup.and.saucer.fill',
    dance: 'figure.dance',
    rnb: 'heart.fill',
    'r&b': 'heart.fill',
    soul: 'heart.fill',
    blues: 'music.quarternote.3',
    christian: 'cross.fill',
    religious: 'cross.fill',
    latin: 'music.mic',
    indie: 'guitars',
    ambient: 'cloud.fill',
    chillout: 'moon.fill',
    lounge: 'sofa.fill',
    '80s': 'sparkles',
    '90s': 'sparkles',
    '70s': 'sparkles',
    '60s': 'sparkles',
    hits: 'chart.line.uptrend.xyaxis',
    top40: 'chart.bar.fill',
    default: 'radio.fill',
  };
  
  const getGenreSFSymbol = (genreName: string): string => {
    const key = genreName.toLowerCase().replace(/[\s_]/g, '-');
    return genreSFSymbols[key] || genreSFSymbols.default;
  };
  
  try {
    
    // COLD START FIX: Increased timeout to 10s for cold start scenarios
    const TIMEOUT_MS = 10000;
    const timeoutPromise = new Promise<{ name: string; count: number }[]>((resolve) => 
      setTimeout(() => {
        console.log('[CarPlay] Genres timeout - returning empty');
        resolve([]);
      }, TIMEOUT_MS)
    );
    
    const genres = await Promise.race([getGenresCallback(), timeoutPromise]);
    if (!sessionIsCurrent(generation)) return null;
    
    // Using ListTemplate with genre-specific LOCAL icons - no backend dependency
    // Each genre gets its own icon (rock guitar, jazz sax, pop mic, etc.)
    
    console.log('[CarPlay] Using ListTemplate for genres with GENRE-SPECIFIC icons');
    
    const template = new ListTemplate({
      title: t('carplay_genres', 'Genres'),
      tabTitle: t('carplay_genres', 'Genres'),
      tabSystemImageName: 'square.grid.2x2.fill',
      sections: [{
        header: `${t('carplay_music_genres', 'Music Genres')} (${Math.min(genres.length, 40)})`,
        items: genres.slice(0, 40).map(genre => {
          // Get genre-specific icon (rock, pop, jazz, etc.) or default
          const genreIcon = getGenreIcon(genre.name);
          
          return {
            text: genre.name,
            // Don't show global count - it's misleading since genre detail shows filtered/local count
            detailText: t('carplay_stations', 'Sender'),
            // Use genre-specific LOCAL icon - works offline, no backend dependency
            image: genreIcon,
          };
        }),
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const genre = genres[index];
        if (genre) {
          console.log('[CarPlay] Genre selected:', genre.name);
          await showGenreStationsTemplate(genre.name);
        }
      },
    });
    
    return template;
  } catch (error: any) {
    console.error('[CarPlay] Error creating genres template:', error);
    return null;
  }
};

// Create Genre Stations List Template
const showGenreStationsTemplate = async (genre: string): Promise<void> => {
  if (!isCarPlayConnected) return;
  const generation = connectionGeneration;
  
  if (!ListTemplate || !CarPlay || !getStationsByGenreCallback) {
    console.error('[CarPlay] showGenreStationsTemplate failed - missing dependencies:', {
      ListTemplate: !!ListTemplate,
      CarPlay: !!CarPlay,
      getStationsByGenreCallback: !!getStationsByGenreCallback,
    });
    return;
  }
  
  try {
    console.log('[CarPlay] Fetching stations for genre:', genre);
    
    // Add timeout for genre station fetch (max 15 seconds)
    const TIMEOUT_MS = 15000;
    const timeoutPromise = new Promise<Station[]>((resolve) => 
      setTimeout(() => {
        console.warn('[CarPlay] Genre stations timeout for:', genre);
        resolve([]);
      }, TIMEOUT_MS)
    );
    
    const stations = await Promise.race([getStationsByGenreCallback(genre), timeoutPromise]);
    if (!sessionIsCurrent(generation)) return;
    
    console.log('[CarPlay] Got', stations.length, 'stations for genre:', genre);
    
    // If no stations found, show an informative message
    if (!stations || stations.length === 0) {
      console.warn('[CarPlay] No stations found for genre:', genre);
      
      // Show empty state template
      const emptyTemplate = new ListTemplate({
        title: genre,
        sections: [{
          header: genre,
          items: [{
            text: t('carplay_no_stations', 'No stations found'),
            detailText: t('carplay_try_another_genre', 'Try another genre'),
          }],
        }],
      });
      
      CarPlay.pushTemplate(emptyTemplate, true);
      return;
    }
    
    // Build items with imgUrl for async native image loading (max 50)
    const stationsSlice = stations.slice(0, 50);
    const items = stationsSlice.map(station => {
      const imgUrl = getArtworkUrl(station);
      return {
        text: station.name,
        detailText: station.country || 'Radio',
        image: LOCAL_FALLBACK_LOGO,
        imgUrl: imgUrl,
      };
    });
    
    const template = new ListTemplate({
      title: genre,
      sections: [{
        header: `${genre} (${stationsSlice.length})`,
        items,
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const station = stationsSlice[index];
        if (station && playStationCallback) {
          console.log('[CarPlay] Playing from genre:', station.name);
          try {
            await playStationCallback(station);
            showNowPlayingTemplate(station);
          } catch (e: any) {
          }
        }
      },
    });
    
    CarPlay.pushTemplate(template, true);
  } catch (error: any) {
    console.error('[CarPlay] Error showing genre stations:', error);
  }
};

// Create Browse/Popular Stations List Template (50 stations with logos)
const createBrowseTemplate = async (): Promise<any> => {
  const generation = connectionGeneration;
  
  if (!ListTemplate || !getStationsCallback) {
    return null;
  }
  
  try {
    
    // COLD START FIX: Increased timeout to 10s for cold start scenarios
    const TIMEOUT_MS = 10000;
    const timeoutPromise = new Promise<Station[]>((resolve) => 
      setTimeout(() => {
        console.log('[CarPlay] Browse/Popular timeout - returning empty');
        resolve([]);
      }, TIMEOUT_MS)
    );
    
    const stations = await Promise.race([getStationsCallback(), timeoutPromise]);
    if (!sessionIsCurrent(generation)) return null;
    
    // Build items with imgUrl for async native image loading (max 50)
    const stationsSlice = stations.slice(0, 50);
    
    // SAVE TO NATIVE CACHE for next cold start
    if (stations.length > 0) {
      saveToNativeCache(stations, 'popular');
    }
    
    const items = stationsSlice.map(station => {
      const imgUrl = getArtworkUrl(station);
      return {
        text: station.name,
        detailText: station.country || station.tags?.split(',')[0] || 'Radio',
        image: LOCAL_FALLBACK_LOGO,
        imgUrl: imgUrl,
      };
    });
    
    const template = new ListTemplate({
      title: t('carplay_discover', 'Discover'),
      tabTitle: t('carplay_discover', 'Discover'),
      tabSystemImageName: 'music.note.list',
      sections: [{
        header: `${t('carplay_popular_stations', 'Popular Stations')} (${Math.min(stations.length, 50)})`,
        items,
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const station = stationsSlice[index];
        if (station && playStationCallback) {
          console.log('[CarPlay] Playing from browse:', station.name);
          try {
            await playStationCallback(station);
            showNowPlayingTemplate(station);
          } catch (e: any) {
          }
        }
      },
    });
    
    return template;
  } catch (error: any) {
    console.error('[CarPlay] Error creating browse template:', error);
    return null;
  }
};

// Show Now Playing Template - Enhanced with favorite button, Up Next, and proper callbacks
const showNowPlayingTemplate = (station: Station, songTitle?: string, artistName?: string): void => {
  if (!NowPlayingTemplate || !CarPlay || !isCarPlayConnected) return;
  
  // ANDROID AUTO GUARD: Skip if carContext may not be ready
  if (Platform.OS === 'android' && !isCarPlayConnected) {
    console.log('[CarPlay] Android: skipping NowPlaying - not connected');
    return;
  }
  
  // Track the current station for button callbacks
  currentNowPlayingStation = station;
  
  try {
    // Build buttons array for NowPlaying controls
    // These appear as circular buttons below the main play/pause/skip controls
    const buttons: any[] = [];
    
    // 1. Add-to-library button (heart/favorite toggle) - uses iOS system icon
    buttons.push({
      id: 'toggle-favorite',
      type: 'add-to-library',
    });
    
    // 2. More button - for additional options
    buttons.push({
      id: 'more-options',
      type: 'more',
    });
    
    const nowPlayingTemplate = new NowPlayingTemplate({
      // Enable Up Next button - shows next similar station
      upNextButtonEnabled: true,
      upNextButtonTitle: t('carplay_up_next', 'Up Next'),
      // Disable album artist button - not needed for radio
      albumArtistButtonEnabled: false,
      // Custom buttons
      buttons: buttons,
      // Handle custom button presses
      onButtonPressed: async (e: { id: string; templateId: string }) => {
        console.log('[CarPlay NowPlaying] Button pressed:', e.id);
        
        if (e.id === 'toggle-favorite' && currentNowPlayingStation) {
          // Toggle favorite for current station
          if (toggleFavoriteCallback) {
            try {
              await toggleFavoriteCallback(currentNowPlayingStation);
              const stationId = currentNowPlayingStation._id || (currentNowPlayingStation as any).id;
              const isNowFavorite = isFavoriteCallback ? isFavoriteCallback(stationId) : false;
              console.log('[CarPlay NowPlaying] Favorite toggled:', currentNowPlayingStation.name, '-> isFavorite:', isNowFavorite);
            } catch (err) {
              console.error('[CarPlay NowPlaying] Toggle favorite error:', err);
            }
          }
        } else if (e.id === 'more-options') {
          console.log('[CarPlay NowPlaying] More options pressed for:', currentNowPlayingStation?.name);
        }
      },
      // Handle Up Next button press - play next similar station
      onUpNextButtonPressed: async () => {
        console.log('[CarPlay NowPlaying] Up Next pressed');
        
        if (getNextStationCallback && playStationCallback) {
          try {
            const nextStation = await getNextStationCallback();
            if (nextStation) {
              console.log('[CarPlay NowPlaying] Playing next station:', nextStation.name);
              await playStationCallback(nextStation);
              // Update NowPlaying with new station
              showNowPlayingTemplate(nextStation);
            } else {
              console.log('[CarPlay NowPlaying] No next station available');
            }
          } catch (err) {
            console.error('[CarPlay NowPlaying] Up Next error:', err);
          }
        }
      },
    });
    
    CarPlay.pushTemplate(nowPlayingTemplate, true);
    console.log('[CarPlay] Showing enhanced NowPlaying for:', station.name, 
      '| buttons:', buttons.length, 
      '| upNext: enabled');
  } catch (error) {
    console.error('[CarPlay] Error showing now playing:', error);
  }
};

// Create Search Template for CarPlay
const createSearchTemplate = async (): Promise<any> => {
  if (!SearchTemplate || !ListTemplate) {
    return null;
  }
  
  try {
    
    // Track search results for item selection
    let searchResults: Station[] = [];
    
    const searchTemplate = new SearchTemplate({
      // Called when user types in search field
      onSearch: async (query: string) => {
        console.log('[CarPlay Search] Query:', query);
        
        if (!query || query.length < 2) {
          searchResults = [];
          return [];
        }
        
        try {
          if (searchStationsCallback) {
            searchResults = await searchStationsCallback(query);
            console.log('[CarPlay Search] Found', searchResults.length, 'stations');
            
            // Return results for display - each item needs text and detailText
            return searchResults.slice(0, 20).map((station: Station) => ({
              text: station.name,
              detailText: station.country || station.tags?.split(',')[0] || 'Radio',
            }));
          } else {
            return [];
          }
        } catch (error: any) {
          console.error('[CarPlay Search] Error:', error);
          return [];
        }
      },
      
      // Called when user selects a search result
      onItemSelect: async ({ index }: { index: number }) => {
        console.log('[CarPlay Search] Selected index:', index);
        
        const station = searchResults[index];
        if (station && playStationCallback) {
          console.log('[CarPlay Search] Playing:', station.name);
          try {
            await playStationCallback(station);
            showNowPlayingTemplate(station);
          } catch (e: any) {
            console.error('[CarPlay Search] Playback error:', e);
          }
        }
      },
      
      // Optional: Called when search button is pressed
      onSearchButtonPressed: () => {
        console.log('[CarPlay Search] Search button pressed');
      },
    });
    
    console.log('[CarPlay] Search template created successfully');
    return searchTemplate;
  } catch (error: any) {
    console.error('[CarPlay] Error creating search template:', error);
    return null;
  }
};

// Open Search Screen (can be called externally via Siri)
const openSearchScreen = async (): Promise<void> => {
  if (!CarPlay || !SearchTemplate || !isCarPlayConnected) {
    console.log('[CarPlay] Cannot open search - not connected or template not available');
    return;
  }
  
  try {
    const searchTemplate = await createSearchTemplate();
    if (searchTemplate) {
      CarPlay.pushTemplate(searchTemplate, true);
      console.log('[CarPlay] Search screen opened');
    }
  } catch (error) {
    console.error('[CarPlay] Error opening search:', error);
  }
};

// Create Root Tab Bar Template
const createRootTemplate = async (): Promise<void> => {
  if (!isCarPlayConnected) return;
  const generation = connectionGeneration;
  // ANDROID AUTO GUARD: On Android, the native carContext may not be initialized yet
  // during cold start. The native patch now returns errors gracefully instead of crashing,
  // but we add a JS-side guard to avoid unnecessary error cycles.
  if (Platform.OS === 'android' && CarPlay) {
    try {
      // checkForConnection is safe to call even without carContext
      // If it doesn't throw, the native module is at least loaded
      // Do not call checkForConnection here: Android emits another didConnect,
      // which previously caused a root-template rebuild loop.
    } catch (e) {
      console.log('[CarPlay] Android: Native module not ready yet, deferring template creation');
      return;
    }
  }

  // CRASH FIX: Prevent concurrent template creation which can cause
  // REASwizzledUIManager race condition with RCTUIManager
  if (isCreatingTemplate) {
    // Mark that a refresh is pending so we rebuild after current creation finishes
    pendingCallbackRefresh = true;
    return;
  }
  
  isCreatingTemplate = true;
  pendingCallbackRefresh = false;
  
  if (!TabBarTemplate || !CarPlay) {
    console.log('[CarPlay] Templates not available');
    // CRITICAL: Release mutex before returning!
    isCreatingTemplate = false;
    return;
  }
  
  try {
    console.log('[CarPlay] Creating root template...');
    
    // Create all tab templates with individual error handling
    // NOTE: SearchTemplate CANNOT be added as a tab in Audio category apps
    // iOS CarPlay only allows ListTemplate, GridTemplate, InformationTemplate, NowPlayingTemplate as tabs
    // Search will be added as a list item in Browse tab instead
    const startTime = Date.now();
    
    const results = await Promise.allSettled([
      createFavoritesTemplate(),
      createRecentlyPlayedTemplate(),
      createBrowseTemplate(),
      createGenresTemplate(),
      // SearchTemplate removed from tabs - not allowed in Audio apps
    ]);
    
    const duration = Date.now() - startTime;
    
    const [favoritesResult, recentResult, browseResult, genresResult] = results;
    
    const favoritesTemplate = favoritesResult.status === 'fulfilled' ? favoritesResult.value : null;
    const recentTemplate = recentResult.status === 'fulfilled' ? recentResult.value : null;
    const browseTemplate = browseResult.status === 'fulfilled' ? browseResult.value : null;
    const genresTemplate = genresResult.status === 'fulfilled' ? genresResult.value : null;
    if (!sessionIsCurrent(generation)) {
      destroyTemplates([favoritesTemplate, recentTemplate, browseTemplate, genresTemplate]);
      isCreatingTemplate = false;
      if (isCarPlayConnected) void createRootTemplate();
      return;
    }
    
    
    // Log any failures
    if (favoritesResult.status === 'rejected') {
      console.error('[CarPlay] Favorites template failed:', favoritesResult.reason);
    }
    if (recentResult.status === 'rejected') {
      console.error('[CarPlay] Recent template failed:', recentResult.reason);
    }
    if (browseResult.status === 'rejected') {
      console.error('[CarPlay] Browse template failed:', browseResult.reason);
    }
    if (genresResult.status === 'rejected') {
      console.error('[CarPlay] Genres template failed:', genresResult.reason);
    }
    
    // Build tabs array with available templates
    const templates: any[] = [];
    
    if (browseTemplate) {
      templates.push(browseTemplate);
    }
    
    // NOTE: SearchTemplate removed - not allowed as tab in Audio apps
    // Search is triggered via Siri voice commands or programmatically
    
    if (favoritesTemplate) {
      templates.push(favoritesTemplate);
    }
    
    if (recentTemplate) {
      templates.push(recentTemplate);
    }
    
    if (genresTemplate) {
      templates.push(genresTemplate);
    }
    
    
    if (templates.length === 0) {
      console.log('[CarPlay] No templates available - showing fallback');
      // Create a simple fallback list template
      if (ListTemplate) {
        const fallbackTemplate = new ListTemplate({
          title: 'MegaRadio',
          sections: [{
            header: t('carplay_loading', 'Loading...'),
            items: [{
              text: t('carplay_loading', 'Loading...'),
              detailText: 'Lütfen bekleyin',
            }],
          }],
        });
        CarPlay.setRootTemplate(fallbackTemplate, false);
        destroyTemplates(activeRootTemplates);
        activeRootTemplates = [fallbackTemplate];
      }
      // CRITICAL: Release mutex before returning!
      isCreatingTemplate = false;
      return;
    }
    
    // Create tab bar
    const tabBarTemplate = new TabBarTemplate({
      templates: templates,
      onTemplateSelect: (selectedTemplate: any, selectedIndex: number) => {
        console.log('[CarPlay] Tab selected:', selectedIndex);
      },
    });
    
    // Set as root template
    try {
      CarPlay.setRootTemplate(tabBarTemplate, false);
      destroyTemplates(activeRootTemplates);
      activeRootTemplates = [...templates, tabBarTemplate];
      connectionFullyHandled = true;
      console.log('[CarPlay] Root template set successfully with', templates.length, 'tabs');
    } catch (setRootError: any) {
      console.error('[CarPlay] setRootTemplate failed:', setRootError);
    }
    
    // Release mutex after template creation (success or setRootTemplate failure)
    isCreatingTemplate = false;
    
    // If callbacks were updated while we were creating,
    // rebuild templates with the new callbacks (e.g., real playStation)
    // INFINITE LOOP FIX: Only retry once, with longer delay
    if (pendingCallbackRefresh) {
      pendingCallbackRefresh = false;
      setTimeout(() => {
        createRootTemplate().catch((err) => {
        });
      }, 2000); // Increased delay to prevent rapid cycling
    }
    
  } catch (error: any) {
    console.error('[CarPlay] Error creating root template:', error);
    // Release mutex on error as well
    isCreatingTemplate = false;
    
    // On error, retry ONCE if callbacks were updated
    if (pendingCallbackRefresh) {
      pendingCallbackRefresh = false;
      setTimeout(() => {
        createRootTemplate().catch(() => {});
      }, 3000); // Even longer delay on error
    }
  }
};

// CarPlay Service
const CarPlayService: CarPlayServiceType = {
  isConnected: false,
  
  initialize: (
    playStation,
    getStations,
    getFavorites,
    getRecentlyPlayed,
    getGenres,
    getStationsByGenre,
    searchStations,
    toggleFavorite,
    isFavorite,
    getNextStation,
    getPreviousStation
  ) => {
    if (Platform.OS === 'web') {
      console.log('[CarPlayService] Not available on web platform');
      return;
    }
    
    if (!CarPlay) {
      console.log('[CarPlayService] CarPlay module not loaded');
      return;
    }
    
    console.log('[CarPlayService] ===== INITIALIZING =====');
    
    // Store callbacks
    playStationCallback = playStation;
    getStationsCallback = getStations;
    getFavoritesCallback = getFavorites;
    getRecentlyPlayedCallback = getRecentlyPlayed;
    getGenresCallback = getGenres;
    getStationsByGenreCallback = getStationsByGenre;
    searchStationsCallback = searchStations || null;
    toggleFavoriteCallback = toggleFavorite || null;
    isFavoriteCallback = isFavorite || null;
    getNextStationCallback = getNextStation || null;
    getPreviousStationCallback = getPreviousStation || null;
    
    
    // INFINITE LOOP FIX: Unregister old handlers before registering new ones
    // This prevents callback accumulation in the Set<OnConnectCallback>
    // Each registerOnConnect() adds a NEW function to the Set, causing duplicates
    console.log('[CarPlayService] Cleaning up old handlers and re-registering...');
    
    // Unregister the EARLY handlers (they served their purpose)
    if (earlyOnConnectCallback) {
      CarPlay.unregisterOnConnect(earlyOnConnectCallback);
      earlyOnConnectCallback = null;
    }
    if (earlyOnDisconnectCallback) {
      CarPlay.unregisterOnDisconnect(earlyOnDisconnectCallback);
      earlyOnDisconnectCallback = null;
    }
    
    // Unregister previous initialize handlers
    if (registeredOnConnectCallback) {
      CarPlay.unregisterOnConnect(registeredOnConnectCallback);
      registeredOnConnectCallback = null;
    }
    if (registeredOnDisconnectCallback) {
      CarPlay.unregisterOnDisconnect(registeredOnDisconnectCallback);
      registeredOnDisconnectCallback = null;
    }
    
    // Create NEW handler with debounce protection
    registeredOnConnectCallback = () => {
      // INFINITE LOOP FIX: Debounce rapid-fire didConnect events from native module
      const now = Date.now();
      if (now - lastConnectHandledAt < CONNECT_DEBOUNCE_MS) {
        console.log('[CarPlay] onConnect DEBOUNCED - ignoring duplicate event');
        return;
      }
      lastConnectHandledAt = now;
      
      console.log('[CarPlay] ========== CONNECTED (React Native callback) ==========');
      isCarPlayConnected = true;
      CarPlayService.isConnected = true;
      pendingConnection = false;
      
      // Create and show root template
      // ANDROID AUTO FIX: Add a small delay on Android to allow carContext to fully initialize
      const templateDelay = Platform.OS === 'android' ? 500 : 0;
      
      
      const doCreateTemplate = () => {
        createRootTemplate().then(() => {
          // Stop cold-start timer once template is successfully created
          if (coldStartRetryTimer) {
            clearInterval(coldStartRetryTimer);
            coldStartRetryTimer = null;
          }

          // CONTINUOUS LISTENING: if a station is already playing on the
          // phone when the user plugs into CarPlay (eg. they were jogging
          // and got into the car), automatically push NowPlayingTemplate
          // on top of the root template so audio appears front-and-center
          // — no extra taps needed. Mirrors Spotify / Apple Music UX.
          try {
            // Lazy-import to avoid a circular dep at module init time.
            // playerStore is a zustand store with a sync getState().
            const playerStoreMod = require('../store/playerStore');
            const usePlayerStore = playerStoreMod?.usePlayerStore;
            const currentStation = usePlayerStore?.getState?.()?.currentStation;
            const nowPlaying = usePlayerStore?.getState?.()?.nowPlaying;
            if (currentStation && NowPlayingTemplate && CarPlay) {
              showNowPlayingTemplate(
                currentStation,
                nowPlaying?.songTitle,
                nowPlaying?.artistName,
              );
            } else {
            }
          } catch (autoErr) {
          }
        }).catch((err) => {
        });
      };
      
      if (templateDelay > 0) {
        setTimeout(doCreateTemplate, templateDelay);
      } else {
        doCreateTemplate();
      }
    };
    
    CarPlay.registerOnConnect(registeredOnConnectCallback);
    
    // Register CarPlay disconnection handler
    console.log('[CarPlayService] Registering onDisconnect handler...');
    
    registeredOnDisconnectCallback = () => {
      console.log('[CarPlay] ========== DISCONNECTED (React Native callback) ==========');
      isCarPlayConnected = false;
      CarPlayService.isConnected = false;
      connectionGeneration++;
      destroyTemplates(activeRootTemplates);
      activeRootTemplates = [];
      pendingConnection = false;
      connectionFullyHandled = false;
      lastConnectHandledAt = 0; // Reset debounce on disconnect
    };
    
    CarPlay.registerOnDisconnect(registeredOnDisconnectCallback);
    
    
    // CRITICAL: Check if CarPlay was already connected before we registered
    // This handles the race condition where CarPlay connects before JS initializes
    const alreadyConnected = CarPlay.connected || pendingConnection;
    
    if (alreadyConnected) {
      console.log('[CarPlay] Already connected - creating root template immediately');
      isCarPlayConnected = true;
      CarPlayService.isConnected = true;
      pendingConnection = false;
      lastConnectHandledAt = Date.now(); // Mark as handled to debounce future events
      
      // ANDROID AUTO FIX: Delay template creation on Android to allow carContext initialization
      const templateDelay = Platform.OS === 'android' ? 800 : 0;
      
      const doCreate = () => {
        createRootTemplate().then(() => {
          // Stop cold-start timer
          if (coldStartRetryTimer) {
            clearInterval(coldStartRetryTimer);
            coldStartRetryTimer = null;
          }
        }).catch((err) => {
        });
      };
      
      if (templateDelay > 0) {
        setTimeout(doCreate, templateDelay);
      } else {
        doCreate();
      }
    }
    
    console.log('[CarPlayService] Initialized and waiting for connection');
    
    // COLD-START FIX: Start periodic check for CarPlay connection
    // INFINITE LOOP FIX: Removed checkForConnection() on Android (causes event flooding)
    // Reduced retry count and increased interval
    if (coldStartRetryTimer) {
      clearInterval(coldStartRetryTimer);
      coldStartRetryTimer = null;
    }
    coldStartRetryCount = 0;
    
    if (!connectionFullyHandled) {
      coldStartRetryTimer = setInterval(() => {
        coldStartRetryCount++;
        
        // INFINITE LOOP FIX: Do NOT call checkForConnection() on Android
        // It causes native module to fire didConnect events in a tight loop
        if (Platform.OS === 'ios') {
          try {
            if (CarPlay?.bridge?.checkForConnection) {
              CarPlay.bridge.checkForConnection();
            }
          } catch (e) {
            // Ignore errors
          }
        }
        
        // Check if CarPlay is now connected (via the connected property, not events)
        const nowConnected = CarPlay?.connected || false;
        
        
        // If connected but not yet handled, create template
        if (nowConnected && !connectionFullyHandled && !isCreatingTemplate && playStationCallback) {
          isCarPlayConnected = true;
          CarPlayService.isConnected = true;
          lastConnectHandledAt = Date.now();
          
          createRootTemplate().then(() => {
            if (coldStartRetryTimer) {
              clearInterval(coldStartRetryTimer);
              coldStartRetryTimer = null;
            }
          }).catch((err) => {
          });
        }
        
        // Stop after max retries or if connection is handled
        if (coldStartRetryCount >= MAX_COLD_START_RETRIES || connectionFullyHandled) {
          if (coldStartRetryTimer) {
            clearInterval(coldStartRetryTimer);
            coldStartRetryTimer = null;
          }
        }
      }, COLD_START_RETRY_INTERVAL);
    }
    
    // Subscribe to language changes - refresh templates when language changes
    if (!languageListenerUnsubscribe) {
      languageListenerUnsubscribe = addLanguageChangeListener((newLang) => {
        needsTemplateRefresh = true;
        
        // If currently connected, refresh templates
        if (isCarPlayConnected && CarPlay) {
          createRootTemplate().catch((err) => {
          });
        }
      });
    }
  },
  
  updateNowPlaying: (station, songTitle, artistName) => {
    if (!isCarPlayConnected) return;
    
    // Track the current station for NowPlaying button callbacks
    currentNowPlayingStation = station;
    
    console.log('[CarPlay] Updating now playing:', station.name, songTitle, artistName);
  },
  
  disconnect: () => {
    console.log('[CarPlayService] Disconnecting...');
    
    // Stop cold-start retry timer
    if (coldStartRetryTimer) {
      clearInterval(coldStartRetryTimer);
      coldStartRetryTimer = null;
    }
    coldStartRetryCount = 0;
    
    // INFINITE LOOP FIX: Unregister all callbacks to prevent accumulation
    if (CarPlay) {
      if (registeredOnConnectCallback) {
        CarPlay.unregisterOnConnect(registeredOnConnectCallback);
        registeredOnConnectCallback = null;
      }
      if (registeredOnDisconnectCallback) {
        CarPlay.unregisterOnDisconnect(registeredOnDisconnectCallback);
        registeredOnDisconnectCallback = null;
      }
      if (earlyOnConnectCallback) {
        CarPlay.unregisterOnConnect(earlyOnConnectCallback);
        earlyOnConnectCallback = null;
      }
      if (earlyOnDisconnectCallback) {
        CarPlay.unregisterOnDisconnect(earlyOnDisconnectCallback);
        earlyOnDisconnectCallback = null;
      }
    }
    handlersRegistered = false;
    
    // Unsubscribe from language changes
    if (languageListenerUnsubscribe) {
      languageListenerUnsubscribe();
      languageListenerUnsubscribe = null;
    }
    
    playStationCallback = null;
    getStationsCallback = null;
    getFavoritesCallback = null;
    getRecentlyPlayedCallback = null;
    getGenresCallback = null;
    getStationsByGenreCallback = null;
    searchStationsCallback = null;
    toggleFavoriteCallback = null;
    isFavoriteCallback = null;
    getNextStationCallback = null;
    getPreviousStationCallback = null;
    currentNowPlayingStation = null;
    isCarPlayConnected = false;
    CarPlayService.isConnected = false;
    connectionGeneration++;
    destroyTemplates(activeRootTemplates);
    activeRootTemplates = [];
    pendingConnection = false;
    needsTemplateRefresh = false;
    connectionFullyHandled = false;
    lastConnectHandledAt = 0;
  },
  
  // Open Search Screen - can be triggered by Siri voice command
  openSearch: openSearchScreen,
  
  /**
   * Refresh all CarPlay templates
   * Call this when app state changes (country, favorites, recently played)
   */
  refreshTemplates: async (): Promise<void> => {
    if (!isCarPlayConnected || !CarPlay) {
      console.log('[CarPlayService] Cannot refresh - not connected');
      return;
    }
    
    console.log('[CarPlayService] Refreshing all templates...');
    
    try {
      await createRootTemplate();
      console.log('[CarPlayService] Templates refreshed successfully');
    } catch (err) {
      console.error('[CarPlayService] Failed to refresh templates:', err);
    }
  },
  
  /**
   * Refresh only the Favorites tab template
   */
  refreshFavorites: async (): Promise<void> => {
    if (!isCarPlayConnected || !CarPlay || !TabBarTemplate) {
      console.log('[CarPlayService] Cannot refresh favorites - not connected or no TabBarTemplate');
      return;
    }
    
    console.log('[CarPlayService] Refreshing favorites template...');
    
    try {
      const favTemplate = await createFavoritesTemplate();
      if (favTemplate) {
        // Full refresh since individual tab update may not be supported
        await createRootTemplate();
      }
    } catch (err) {
      console.error('[CarPlayService] Failed to refresh favorites:', err);
    }
  },
  
  /**
   * Refresh only the Recently Played tab template  
   */
  refreshRecentlyPlayed: async (): Promise<void> => {
    if (!isCarPlayConnected || !CarPlay) {
      console.log('[CarPlayService] Cannot refresh recently played - not connected');
      return;
    }
    
    console.log('[CarPlayService] Refreshing recently played template...');
    
    try {
      // Full refresh since individual tab update may not be supported
      await createRootTemplate();
    } catch (err) {
      console.error('[CarPlayService] Failed to refresh recently played:', err);
    }
  },
};

export default CarPlayService;
