// Station Types
export interface Station {
  _id: string;
  name: string;
  url: string;
  url_resolved?: string;
  urlResolved?: string;  // API returns camelCase, support both
  homepage?: string;
  favicon?: string;
  localImagePath?: string;
  logo?: string;
  logoAssets?: {
    folder?: string;
    webp48?: string;
    webp96?: string;
    webp192?: string;
    webp256?: string;
    webp384?: string;
    webp512?: string;
    webp768?: string;
    original?: string;
    status?: string;
    processedAt?: string;
  };
  tags?: string;
  country?: string;
  countrycode?: string;  // API returns lowercase
  countryCode?: string;  // Support both cases
  state?: string;
  city?: string;
  language?: string;
  languagecodes?: string;
  votes?: number;
  averageRating?: number;
  totalRatings?: number;
  clickCount?: number;
  lastCheckOk?: boolean;
  lastCheckTime?: string;
  codec?: string;
  bitrate?: number;
  hls?: boolean;
  genres?: string[];
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StationResponse {
  stations: Station[];
  totalCount: number;
  count: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PrecomputedStationResponse {
  success: boolean;
  data: Station[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// User Types
export interface User {
  preferences?: { profileGender?: 'female'|'male'|'other'|'undisclosed'; profileCountryCode?: string|null; [key:string]: unknown };
  _id: string;
  id?: string;
  email: string;
  name: string;
  fullName?: string;
  username?: string;
  avatar?: string | null;
  profilePhoto?: string | null;
  isPublicProfile?: boolean;
  favoriteStations?: string[];
  recentlyPlayedStations?: string[];
  totalListeningTime?: number;
  followers?: number;
  following?: number;
  followersCount?: number;
  followingCount?: number;
  favoriteStationsCount?: number;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface AuthCheckResponse {
  user: User | null;
  authenticated: boolean;
}

// Genre Types
export interface Genre {
  _id: string;
  name: string;
  slug: string;
  stationCount?: number;
  total_stations?: number;
  icon?: string;
  color?: string;
  posterImage?: string;
  discoverableImage?: string;
  isDiscoverable?: boolean;
  isDynamic?: boolean;
}

export interface GenreResponse {
  data: Genre[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Stream Types
export interface StreamResolveResponse {
  originalUrl: string;
  playlistType: 'direct' | 'm3u' | 'pls' | 'hls';
  candidates: string[];
  resolvedAt: number;
}

// Metadata Types
export interface NowPlayingMetadata {
  title?: string;
  song?: string;
  artist?: string;
  station?: string;
  album?: string;
  timestamp?: number;
}

// Location Types
export interface UserLocation {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
}

export interface LocationResponse {
  location: UserLocation;
}

// Favorites Types
export interface FavoritesResponse {
  favorites: Station[];
  count: number;
}
