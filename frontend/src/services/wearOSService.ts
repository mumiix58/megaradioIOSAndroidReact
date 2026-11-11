// wearOSService.ts
// Service to handle Wear OS (Android) communication from React Native
// Complements watchService.ts (iOS) for cross-platform watch support

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { getStationStreamUrl } from '../utils/streamSources';

const WearDataLayer = Platform.OS === 'android' ? NativeModules.WearDataLayer : null;

interface WearOSCommand {
  command: string;
  data?: string;
}

type WearOSCommandListener = (command: WearOSCommand) => void;

class WearOSService {
  initializeConnectivity() { WearDataLayer?.initialize?.(); }
  private eventEmitter: NativeEventEmitter | null = null;
  private commandListeners: Set<WearOSCommandListener> = new Set();
  private isInitialized = false;

  constructor() {
    if (Platform.OS === 'android' && WearDataLayer) {
      try {
        this.eventEmitter = new NativeEventEmitter(WearDataLayer);
        this.setupListeners();
        this.isInitialized = true;
        console.log('[WearOSService] Initialized successfully');
      } catch (error) {
        console.log('[WearOSService] Initialization failed:', error);
        this.isInitialized = false;
      }
    } else {
      console.log('[WearOSService] Not available (non-Android or no native module)');
    }
  }

  private setupListeners() {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('onWearCommand', (event: WearOSCommand) => {
      console.log('[WearOSService] Received command:', event);
      this.commandListeners.forEach(listener => listener(event));
    });
  }

  async isWearConnected(): Promise<boolean> {
    if (!this.isInitialized || !WearDataLayer) return false;
    try {
      return await WearDataLayer.isWearConnected();
    } catch (error) {
      console.log('[WearOSService] Error checking wear connection:', error);
      return false;
    }
  }

  updateNowPlaying(station: any, isPlaying: boolean, songTitle: string, artistName: string) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      const stationJson = JSON.stringify({
        id: station._id || station.id || '',
        name: station.name || '',
        country: station.country || '',
        city: station.city || '',
        logoUrl: station.logo || station.favicon || '',
        streamUrl: getStationStreamUrl(station),
        genre: station.genres?.[0] || station.genre || '',
      });
      WearDataLayer.updateNowPlaying(stationJson, isPlaying, songTitle || '', artistName || '');
    } catch (error) {
      console.log('[WearOSService] Error updating now playing:', error);
    }
  }

  updateFavorites(favorites: any[]) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      const mapped = favorites.map(s => ({
        id: s._id || s.id || '',
        name: s.name || '',
        country: s.country || '',
        city: s.city || '',
        logoUrl: s.logo || s.favicon || '',
        streamUrl: getStationStreamUrl(s),
        genre: s.genres?.[0] || s.genre || '',
      }));
      WearDataLayer.updateFavorites(JSON.stringify(mapped));
    } catch (error) {
      console.log('[WearOSService] Error updating favorites:', error);
    }
  }

  updateStations(stations: any[], response?: { requestId: string; error: string }) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      const mapped = stations.map(s => ({
        id: s._id || s.id || '',
        name: s.name || '',
        country: s.country || '',
        city: s.city || '',
        logoUrl: s.logo || s.favicon || '',
        streamUrl: getStationStreamUrl(s),
        genre: s.genres?.[0] || s.genre || '',
      }));
      if (response) {
        WearDataLayer.updateStationResponse(response.requestId, JSON.stringify(mapped), response.error);
      } else {
        WearDataLayer.updateStations(JSON.stringify(mapped));
      }
    } catch (error) {
      console.log('[WearOSService] Error updating stations:', error);
    }
  }

  updateGenres(genres: any[]) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      const mapped = genres.map(g => ({
        id: g.slug || g.id || g.name?.toLowerCase().replace(/\s+/g, '-') || '',
        name: g.name || '',
      }));
      WearDataLayer.updateGenres(JSON.stringify(mapped));
    } catch (error) {
      console.log('[WearOSService] Error updating genres:', error);
    }
  }

  updateCountries(countries: any[]) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      const mapped = countries.map(c => ({
        code: c.code || c.iso_3166_1 || '',
        name: c.name || '',
      }));
      WearDataLayer.updateCountries(JSON.stringify(mapped));
    } catch (error) {
      console.log('[WearOSService] Error updating countries:', error);
    }
  }

  updatePlaybackState(isPlaying: boolean, songTitle?: string, artistName?: string) {
    if (!this.isInitialized || !WearDataLayer) return;
    try {
      WearDataLayer.updatePlaybackState(isPlaying, songTitle || '', artistName || '');
    } catch (error) {
      console.log('[WearOSService] Error updating playback state:', error);
    }
  }

  addCommandListener(listener: WearOSCommandListener): () => void {
    this.commandListeners.add(listener);
    return () => {
      this.commandListeners.delete(listener);
    };
  }

  removeAllListeners() {
    this.commandListeners.clear();
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('onWearCommand');
    }
  }
}

export const wearOSService = new WearOSService();
export default wearOSService;
