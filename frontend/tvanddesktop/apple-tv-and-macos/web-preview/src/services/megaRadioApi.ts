// Mega Radio API Service - VERSION 3.0 - COUNTRY FILTERED GENRES
// In preview mode (served from preview.emergentagent.com), route through our backend
// proxy at /api/tv-proxy/* to bypass Cloudflare bot-protection on the headless browser.
// On real Apple TV / macOS / Tizen / webOS the page is loaded from a non-Cloudflare-blocked
// origin so we hit the production API directly.
const __isPreview = typeof window !== 'undefined' && window.location && /preview\.emergentagent\.com$/i.test(window.location.hostname);
const BASE_URL = __isPreview ? window.location.origin : 'https://api.themegaradio.com';
const API_PREFIX = __isPreview ? '/api/tv-proxy' : '/api';
export const SUBSCRIPTION_API_URL = BASE_URL + API_PREFIX + '/user/subscription';

const isSamsungTV = typeof window !== 'undefined' && (
  navigator.userAgent.toLowerCase().includes('tizen') ||
  navigator.userAgent.toLowerCase().includes('samsung')
);

// Add ?tv=1 query parameter for Samsung TV to signal backend to skip compression
const TV_PARAM = isSamsungTV ? '?tv=1' : '';

export interface Station {
  _id: string;
  changeuuid?: string;
  stationuuid?: string;
  name: string;
  slug?: string;
  url: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  faviconFallback?: string;
  tags?: string | string[];
  country?: string;
  countrycode?: string;
  countryCode?: string;
  state?: string;
  language?: string;
  languagecodes?: string;
  votes?: number;
  clickcount?: number;
  clicktrend?: number;
  codec?: string;
  bitrate?: number;
  hls?: number;
  lastcheckok?: number;
  lastchecktime?: string;
  clicktimestamp?: string;
  geo_lat?: number;
  geo_long?: number;
  has_extended_info?: boolean;
  ssl_error?: number;
}

export interface Genre {
  _id?: string;
  slug: string;
  name: string;
  poster?: string;
  stationCount?: number;
}

export interface Country {
  name: string;
  iso_3166_1: string;
  stationcount?: number;
}

export interface Language {
  name: string;
  iso_639: string;
  stationcount?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Map country names to ISO 3166-1 codes
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'Afghanistan': 'AF', 'Aland Islands': 'AX', 'Albania': 'AL', 'Algeria': 'DZ',
  'American Samoa': 'AS', 'Andorra': 'AD', 'Angola': 'AO', 'Anguilla': 'AI',
  'Antarctica': 'AQ', 'Antigua And Barbuda': 'AG', 'Argentina': 'AR', 'Armenia': 'AM',
  'Aruba': 'AW', 'Ascension And Tristan Da Cunha Saint Helena': 'SH',
  'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bahrain': 'BH', 'Bangladesh': 'BD', 'Barbados': 'BB', 'Belarus': 'BY',
  'Belgium': 'BE', 'Belize': 'BZ', 'Benin': 'BJ', 'Bermuda': 'BM',
  'Bhutan': 'BT', 'Bolivarian Republic Of Venezuela': 'VE', 'Bolivia': 'BO',
  'Bonaire': 'BQ', 'Bosnia And Herzegovina': 'BA', 'Botswana': 'BW',
  'Brazil': 'BR', 'British Indian Ocean Territory': 'IO', 'British Virgin Islands': 'VG',
  'Brunei Darussalam': 'BN', 'Bulgaria': 'BG', 'Burkina Faso': 'BF', 'Burundi': 'BI',
  'Cabo Verde': 'CV', 'Cambodia': 'KH', 'Cameroon': 'CM', 'Canada': 'CA',
  'Chad': 'TD', 'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO',
  'Costa Rica': 'CR', 'Coted Ivoire': 'CI', 'Croatia': 'HR', 'Cuba': 'CU',
  'Curacao': 'CW', 'Cyprus': 'CY', 'Czechia': 'CZ',
  'Denmark': 'DK', 'Djibouti': 'DJ', 'Dominica': 'DM',
  'Ecuador': 'EC', 'Egypt': 'EG', 'El Salvador': 'SV', 'Eritrea': 'ER',
  'Estonia': 'EE', 'Ethiopia': 'ET',
  'Fiji': 'FJ', 'Finland': 'FI', 'France': 'FR', 'French Guiana': 'GF',
  'French Polynesia': 'PF',
  'Gabon': 'GA', 'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH',
  'Gibraltar': 'GI', 'Greece': 'GR', 'Greenland': 'GL', 'Grenada': 'GD',
  'Guadeloupe': 'GP', 'Guam': 'GU', 'Guatemala': 'GT', 'Guernsey': 'GG',
  'Guinea': 'GN', 'Guinea Bissau': 'GW', 'Guyana': 'GY',
  'Haiti': 'HT', 'Honduras': 'HN', 'Hong Kong': 'HK', 'Hungary': 'HU',
  'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Islamic Republic Of Iran': 'IR',
  'Isle Of Man': 'IM', 'Israel': 'IL', 'Italy': 'IT',
  'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO',
  'Kazakhstan': 'KZ', 'Kenya': 'KE', 'Kosovo': 'XK', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG',
  'Latvia': 'LV', 'Lebanon': 'LB', 'Lesotho': 'LS', 'Liberia': 'LR', 'Libya': 'LY',
  'Liechtenstein': 'LI', 'Lithuania': 'LT', 'Luxembourg': 'LU',
  'Macao': 'MO', 'Madagascar': 'MG', 'Malawi': 'MW', 'Malaysia': 'MY',
  'Maldives': 'MV', 'Mali': 'ML', 'Malta': 'MT', 'Martinique': 'MQ',
  'Mauritania': 'MR', 'Mauritius': 'MU', 'Mayotte': 'YT', 'Mexico': 'MX',
  'Monaco': 'MC', 'Mongolia': 'MN', 'Montenegro': 'ME', 'Montserrat': 'MS',
  'Morocco': 'MA', 'Mozambique': 'MZ', 'Myanmar': 'MM',
  'Namibia': 'NA', 'Nepal': 'NP', 'New Caledonia': 'NC', 'New Zealand': 'NZ',
  'Nicaragua': 'NI', 'Nigeria': 'NG', 'Niue': 'NU', 'Norway': 'NO',
  'Oman': 'OM',
  'Pakistan': 'PK', 'Palau': 'PW', 'Panama': 'PA', 'Papua New Guinea': 'PG',
  'Paraguay': 'PY', 'Peru': 'PE', 'Poland': 'PL', 'Portugal': 'PT',
  'Puerto Rico': 'PR',
  'Qatar': 'QA',
  'Republic Of North Macedonia': 'MK', 'Reunion': 'RE', 'Romania': 'RO', 'Rwanda': 'RW',
  'Saint Kitts And Nevis': 'KN', 'Saint Lucia': 'LC',
  'Saint Pierre And Miquelon': 'PM', 'Saint Vincent And The Grenadines': 'VC',
  'San Marino': 'SM', 'Sao Tome And Principe': 'ST', 'Saudi Arabia': 'SA',
  'Senegal': 'SN', 'Serbia': 'RS', 'Seychelles': 'SC', 'Sierra Leone': 'SL',
  'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Solomon Islands': 'SB',
  'Somalia': 'SO', 'South Africa': 'ZA', 'South Sudan': 'SS', 'Spain': 'ES',
  'Sri Lanka': 'LK', 'State Of Palestine': 'PS', 'Suriname': 'SR',
  'Sweden': 'SE', 'Switzerland': 'CH', 'Syrian Arab Republic': 'SY',
  'Taiwan, Republic Of China': 'TW', 'Tajikistan': 'TJ', 'Thailand': 'TH',
  'The Bahamas': 'BS', 'The Cayman Islands': 'KY', 'The Central African Republic': 'CF',
  'The Cocos Keeling Islands': 'CC', 'The Comoros': 'KM', 'The Congo': 'CG',
  'The Cook Islands': 'CK', 'The Democratic Peoples Republic Of Korea': 'KP',
  'The Democratic Republic Of The Congo': 'CD', 'The Dominican Republic': 'DO',
  'The Falkland Islands Malvinas': 'FK', 'The Faroe Islands': 'FO',
  'The French Southern Territories': 'TF', 'The Gambia': 'GM',
  'The Holy See': 'VA', 'The Lao Peoples Democratic Republic': 'LA',
  'The Netherlands': 'NL', 'The Niger': 'NE', 'The Philippines': 'PH',
  'The Republic Of Korea': 'KR', 'The Republic Of Moldova': 'MD',
  'The Russian Federation': 'RU', 'The Sudan': 'SD',
  'The United Arab Emirates': 'AE',
  'The United Kingdom Of Great Britain And Northern Ireland': 'GB',
  'The United States Minor Outlying Islands': 'UM',
  'The United States Of America': 'US',
  'Timor Leste': 'TL', 'Togo': 'TG', 'Tonga': 'TO',
  'Trinidad And Tobago': 'TT', 'Tunisia': 'TN', 'Türkiye': 'TR', 'Turkmenistan': 'TM',
  'Uganda': 'UG', 'Ukraine': 'UA', 'United Republic Of Tanzania': 'TZ',
  'Uruguay': 'UY', 'US Virgin Islands': 'VI', 'Uzbekistan': 'UZ',
  'Vanuatu': 'VU', 'Vietnam': 'VN',
  'Wallis And Futuna': 'WF',
  'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW'
};

// Reverse mapping: CODE to NAME (for API calls)
const CODE_TO_COUNTRY_NAME: Record<string, string> = Object.entries(COUNTRY_NAME_TO_CODE).reduce(
  (acc, [name, code]) => ({ ...acc, [code]: name }),
  {} as Record<string, string>
);

const getCountryCode = (countryName: string): string => {
  return COUNTRY_NAME_TO_CODE[countryName] || 'XX';
};

const getCountryNameFromCode = (code: string): string => {
  return CODE_TO_COUNTRY_NAME[code] || code;
};

// Hash routes may already contain a percent-encoded canonical slug. Encode one
// path segment once; display names must never substitute for backend slugs.
function genrePathSegment(slug: string): string {
  try { return encodeURIComponent(decodeURIComponent(slug)); }
  catch (_) { return encodeURIComponent(slug); }
}

// Helper to add TV parameter for Samsung TV (signals backend to skip compression)
export function buildApiUrl(path: string, existingParams?: URLSearchParams): string {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  
  if (!isSamsungTV) {
    return existingParams ? `${url}?${existingParams}` : url;
  }
  
  // Samsung TV: add tv=1 to signal backend to skip compression
  const params = existingParams || new URLSearchParams();
  params.append('tv', '1');
  return `${url}?${params}`;
}

const FETCH_TIMEOUT = 12000; // 12 second timeout

async function fetchWithTimeout(url: string, options?: RequestInit, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

function slimStation(station: any): Station {
  // Prefer the backend's own S3-hosted, pre-processed logo (https, optimized
  // WebP) over the raw external `favicon`. Per backend brief: use webp256, then
  // webp96 as fallback (both are full https S3/CDN URLs). Do NOT use `original`
  // — it's a bare filename, not a URL.
  const la = station.logoAssets;
  const s3Logo = la && la.status === 'completed' ? (la.webp256 || la.webp96) : null;

  return {
    _id: station._id,
    name: station.name,
    url: station.url,
    url_resolved: station.urlResolved || station.url_resolved,
    homepage: station.homepage,
    favicon: s3Logo || station.favicon,
    // When the S3 logo is the primary, keep the raw favicon as a SECONDARY
    // fallback so the <img> onError chain can try it before the local
    // fallback-station image (S3 → favicon → fallback image).
    faviconFallback: s3Logo && station.favicon && station.favicon !== s3Logo ? station.favicon : undefined,
    tags: station.tags,
    country: station.country,
    countrycode: station.countrycode || station.countryCode,
    countryCode: station.countryCode || station.countrycode,
    state: station.state,
    language: station.language,
    votes: station.votes,
    clickcount: station.clickcount || station.clickCount,
    codec: station.codec,
    bitrate: station.bitrate,
    hls: station.hls,
    slug: station.slug,
  };
}

function slimStations(stations: any[]): Station[] {
  return stations.map(slimStation);
}

export const megaRadioApi = {
  // Stations
  getAllStations: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    language?: string;
    genre?: string;
    tags?: string;
    sort?: 'votes' | 'recent' | 'random' | 'clickcount';
  }): Promise<{ stations: Station[]; pagination: any }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.country) {
      // Convert country code to name for API
      const countryName = getCountryNameFromCode(params.country);
      queryParams.append('country', countryName);
    }
    if (params?.language) queryParams.append('language', params.language);
    if (params?.genre) {
      queryParams.append('genre', params.genre);
    }
    if (params?.tags) queryParams.append('tags', params.tags);
    if (params?.sort) queryParams.append('sort', params.sort);

    try {
      const url = buildApiUrl('/stations', queryParams);
      
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      // API returns { stations: [...] } or just [...]
      const stations = data.stations || (Array.isArray(data) ? data : []);
      
      return { stations: slimStations(stations), pagination: {} };
    } catch (error) {
      return { stations: [], pagination: {} };
    }
  },

  getPopularStations: async (params?: {
    limit?: number;
    country?: string;
    language?: string;
    genre?: string;
    throwOnError?: boolean;
  }): Promise<{ stations: Station[] }> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.country) {
      const countryName = getCountryNameFromCode(params.country);
      queryParams.append('country', countryName);
    }
    if (params?.language) queryParams.append('language', params.language);
    if (params?.genre) queryParams.append('genre', params.genre);
    queryParams.append('sort', 'votes');

    try {
      const url = buildApiUrl('/stations', queryParams);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getPopularStations] HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const stations = data.stations || (Array.isArray(data) ? data : []);
      return { stations: slimStations(stations) };
    } catch (error) {
      if (params?.throwOnError) throw error;
      console.error('[getPopularStations] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [] };
    }
  },

  getWorkingStations: async (params?: {
    limit?: number;
    country?: string;
    offset?: number;
  }): Promise<{ stations: Station[] }> => {
    const queryParams = new URLSearchParams();
    const limit = params?.limit || 21;
    queryParams.append('limit', limit.toString());
    if (params?.offset != null && params.offset > 0) {
      const page = Math.floor(params.offset / limit) + 1;
      queryParams.append('page', page.toString());
    }
    if (params?.country) {
      const countryName = getCountryNameFromCode(params.country);
      queryParams.append('country', countryName);
    }

    const url = buildApiUrl('/stations', queryParams);
    const response = await fetchWithTimeout(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const stations = data.stations || [];
    return { stations: slimStations(stations) };
  },

  getNearbyStations: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
  }): Promise<{ stations: Station[]; totalStations: number }> => {
    try {
      const queryParams = new URLSearchParams({
        lat: params.lat.toString(),
        lng: params.lng.toString(),
      });
      if (params?.radius) queryParams.append('radius', params.radius.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = buildApiUrl('/stations/nearby', queryParams);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getNearbyStations] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [], totalStations: 0 };
      }
      
      return response.json();
    } catch (error) {
      console.error('[getNearbyStations] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [], totalStations: 0 };
    }
  },

  getStationById: async (identifier: string): Promise<{ station: Station | null }> => {
    try {
      const url = buildApiUrl(`/station/${identifier}`);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getStationById] HTTP ${response.status}: ${response.statusText}`);
        return { station: null };
      }
      
      const data = await response.json();
      return { station: slimStation(data) };
    } catch (error) {
      console.error('[getStationById] Error:', error instanceof Error ? error.message : String(error));
      return { station: null };
    }
  },

  getSimilarStations: async (stationId: string, limit?: number): Promise<{ stations: Station[] }> => {
    try {
      const params = limit ? new URLSearchParams({ limit: limit.toString() }) : undefined;
      const url = buildApiUrl(`/stations/similar/${stationId}`, params);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getSimilarStations] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [] };
      }
      
      const data = await response.json();
      return { stations: slimStations(Array.isArray(data) ? data : data.stations || []) };
    } catch (error) {
      console.error('[getSimilarStations] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [] };
    }
  },

  getStationMetadata: async (stationId: string): Promise<{ metadata: { title?: string; artist?: string; album?: string } }> => {
    try {
      const url = buildApiUrl(`/now-playing/${encodeURIComponent(stationId)}`);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getStationMetadata] HTTP ${response.status}: ${response.statusText}`);
        return { metadata: {} };
      }
      
      const data = await response.json();
      return { metadata: data.metadata || data };
    } catch (error) {
      console.error('[getStationMetadata] Error:', error instanceof Error ? error.message : String(error));
      return { metadata: {} };
    }
  },

  // Genres
  getAllGenres: async (country?: string): Promise<{ genres: Genre[] }> => {
    try {
      const params = new URLSearchParams();
      
      // Add filters parameter with country filtering if provided
      if (country) {
        const countryName = getCountryNameFromCode(country);
        const filters = JSON.stringify({
          countrycode: countryName,
          searchQuery: ''
        });
        params.append('filters', filters);
      }
      
      // Add limit to fetch all genres (default API limit is only 9 per page)
      params.append('limit', '500');
      
      const url = buildApiUrl('/genres', params);
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      // Backend may return { genres: [...] } or { data: [...] } depending on filters
      const list = result.genres || result.data || [];
      return { genres: list };
    } catch (error) {
      return { genres: [] };
    }
  },

  getGenreBySlug: async (slug: string): Promise<{ genre: Genre | null }> => {
    try {
      const url = buildApiUrl(`/genres/slug/${genrePathSegment(slug)}`);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getGenreBySlug] HTTP ${response.status}: ${response.statusText}`);
        return { genre: null };
      }
      
      const data = await response.json();
      return { genre: data };
    } catch (error) {
      console.error('[getGenreBySlug] Error:', error instanceof Error ? error.message : String(error));
      return { genre: null };
    }
  },

  getStationsByGenre: async (
    slug: string,
    params?: {
      page?: number;
      limit?: number;
      country?: string;
      sort?: 'votes' | 'recent' | 'random' | 'clickcount';
      offset?: number;
    }
  ): Promise<{ stations: Station[]; pagination: any; genre: Genre }> => {
    const queryParams = new URLSearchParams();
    const limit = params?.limit || 28;
    queryParams.append('limit', limit.toString());
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    } else if (params?.offset && params.offset > 0) {
      const page = Math.floor(params.offset / limit) + 1;
      queryParams.append('page', page.toString());
    }
    if (params?.country && params.country !== 'GLOBAL') {
      const countryName = getCountryNameFromCode(params.country);
      queryParams.append('country', countryName);
    }
    if (params?.sort) queryParams.append('sort', params.sort);

    try {
      const url = buildApiUrl(`/genres/${genrePathSegment(slug)}/stations`, queryParams);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getStationsByGenre] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [], pagination: {}, genre: { slug, name: '' } };
      }
      
      const data = await response.json();
      return { ...data, stations: slimStations(data.stations || []) };
    } catch (error) {
      console.error('[getStationsByGenre] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [], pagination: {}, genre: { slug, name: '' } };
    }
  },

  getDiscoverableGenres: async (): Promise<{ genres: Genre[] }> => {
    try {
      const url = buildApiUrl('/genres/discoverable');
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return { genres: Array.isArray(data) ? data : [] };
    } catch (error) {
      return { genres: [] };
    }
  },

  // Countries
  getAllCountries: async (): Promise<{ countries: Country[] }> => {
    try {
      const url = buildApiUrl('/countries');
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      
      // API returns array of strings, convert to Country objects
      const countries: Country[] = Array.isArray(data) ? data.map((name: string) => ({
        name: name,
        iso_3166_1: getCountryCode(name), // Will map country name to ISO code
        stationcount: 0
      })) : [];
      
      return { countries };
    } catch (error) {
      return { countries: [] };
    }
  },

  // Languages
  getAllLanguages: async (): Promise<{ languages: Language[] }> => {
    try {
      const url = buildApiUrl('/languages');
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getAllLanguages] HTTP ${response.status}: ${response.statusText}`);
        return { languages: [] };
      }
      
      return response.json();
    } catch (error) {
      console.error('[getAllLanguages] Error:', error instanceof Error ? error.message : String(error));
      return { languages: [] };
    }
  },

  // Search
  searchStations: async (params: {
    q: string;
    country?: string;
    language?: string;
    genre?: string;
    bitrate?: number;
    codec?: string;
    limit?: number;
  }): Promise<{ results: Station[]; total: number }> => {
    const queryParams = new URLSearchParams({ search: params.q });
    if (params?.country) queryParams.append('country', params.country);
    if (params?.language) queryParams.append('language', params.language);
    if (params?.genre) queryParams.append('genre', params.genre);
    if (params?.bitrate) queryParams.append('bitrate', params.bitrate.toString());
    if (params?.codec) queryParams.append('codec', params.codec);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    try {
      const url = buildApiUrl('/stations', queryParams);
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return { results: (data.stations || []).map(slimStation), total: data.totalCount || 0 };
    } catch (error) {
      return { results: [], total: 0 };
    }
  },

  // Discovery
  getTopClicked: async (limit?: number): Promise<{ stations: Station[] }> => {
    try {
      const params = limit ? new URLSearchParams({ limit: limit.toString() }) : undefined;
      const url = buildApiUrl('/radio-browser/top-clicked', params);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getTopClicked] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [] };
      }
      
      return response.json();
    } catch (error) {
      console.error('[getTopClicked] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [] };
    }
  },

  getTopVoted: async (limit?: number): Promise<{ stations: Station[] }> => {
    try {
      const params = limit ? new URLSearchParams({ limit: limit.toString() }) : undefined;
      const url = buildApiUrl('/radio-browser/top-voted', params);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getTopVoted] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [] };
      }
      
      return response.json();
    } catch (error) {
      console.error('[getTopVoted] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [] };
    }
  },

  getRecentStations: async (limit?: number): Promise<{ stations: Station[] }> => {
    try {
      const params = limit ? new URLSearchParams({ limit: limit.toString() }) : undefined;
      const url = buildApiUrl('/radio-browser/recent', params);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getRecentStations] HTTP ${response.status}: ${response.statusText}`);
        return { stations: [] };
      }
      
      return response.json();
    } catch (error) {
      console.error('[getRecentStations] Error:', error instanceof Error ? error.message : String(error));
      return { stations: [] };
    }
  },

  // Translations
  getTranslations: async (lang: string): Promise<any> => {
    try {
      const url = buildApiUrl(`/translations/${lang}`);
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        console.error(`[getTranslations] HTTP ${response.status}: ${response.statusText}`);
        return {};
      }
      
      return response.json();
    } catch (error) {
      console.error('[getTranslations] Error:', error instanceof Error ? error.message : String(error));
      return {};
    }
  },

  // Static content pages (About / Terms / Privacy / Contact) served by the backend.
  // Matches mobile app's /api/app/pages endpoint.
  getAppPages: async (): Promise<{ about?: AppPage; terms?: AppPage; privacy?: AppPage; contact?: AppPage }> => {
    try {
      const url = buildApiUrl('/app/pages');
      const response = await fetchWithTimeout(url);
      if (!response.ok) return {};
      const result = await response.json();
      return result.pages || {};
    } catch (error) {
      console.error('[getAppPages] Error:', error instanceof Error ? error.message : String(error));
      return {};
    }
  },
};

export interface AppPage {
  title: string;
  content: string;
}
