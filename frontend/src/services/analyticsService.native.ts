// Firebase Analytics Service for MegaRadio
// Provides centralized event tracking for GA4
// Uses dynamic import to avoid web bundling issues
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { deviceType, DeviceType } from 'expo-device';
import { analyticsLanguage, searchMetrics, type MetricParameters } from '../utils/analyticsMetrics';

let analytics: any = null;

// Lazy load analytics module (native only)
const getAnalytics = async () => {
  if (analytics) return analytics;
  if (Platform.OS === 'web') return null;
  try {
    const mod = require('@react-native-firebase/analytics');
    analytics = mod.default || mod;
    return analytics;
  } catch (e) {
    console.warn('[Analytics] Firebase Analytics not available:', e);
    return null;
  }
};

class AnalyticsService {
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private observing = false;
  private lastScreen: string | null = null;
  private client: any = null;
  private preparingClient: Promise<any> | null = null;

  // All custom events, including child route effects that run before the root
  // initializer, wait for the persisted account identifier to be cleared.
  private async getAnalyticsClient(): Promise<any> {
    if (this.client) return this.client;
    if (this.preparingClient) return this.preparingClient;
    this.preparingClient = (async () => {
      const a = await getAnalytics();
      if (!a) return null;
      await a().setUserId(null);
      this.client = a;
      return a;
    })();
    try { return await this.preparingClient; }
    finally { this.preparingClient = null; }
  }

  async initialize(): Promise<void> {
    if ((this.initialized && this.observing) || Platform.OS === 'web') return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeNative();
    try { await this.initializing; } finally { this.initializing = null; }
  }

  private async initializeNative(): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) {
        if (!this.initialized) {
          await a().setAnalyticsCollectionEnabled(true);
          this.initialized = true;
        }
        // Preserve firebase.json advertising consent defaults and existing ATT/UMP flow.
        if (!this.observing) {
          require('./analyticsObservers').observeMobileAnalytics(this);
          this.observing = true;
        }
        console.log('[Analytics] Firebase Analytics initialized');
      }
    } catch (error) {
      console.warn('[Analytics] Failed to initialize:', error);
    }
  }

  async logEvent(name:string,params:Record<string,string|number>={}):Promise<void>{await this.logDiagnosticEvent(name,params);}
  // Diagnostic events have bounded fields; callers pass catalog IDs and enums only.
  // Locale is the UI selection, not a user's location.
  async logDiagnosticEvent(name: string, parameters: MetricParameters): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (!a) return;
      const language = require('../store/languageStore').useLanguageStore.getState().currentLanguage;
      const build = Constants.nativeBuildVersion || (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode);
      await a().logEvent(name, {
        ...parameters,
        platform: Platform.OS,
        form_factor: deviceType === DeviceType.TABLET ? 'tablet' : deviceType === DeviceType.TV ? 'tv' : deviceType === DeviceType.PHONE ? 'phone' : deviceType === DeviceType.DESKTOP ? 'desktop' : 'unknown',
        app_language: analyticsLanguage(language),
        app_version: String(Constants.expoConfig?.version || 'unknown').substring(0, 36),
        app_build: String(build || 'unknown').substring(0, 36),
        metrics_schema: 1,
      });
    } catch { /* Analytics must never break playback or navigation. */ }
  }

  // Screen tracking
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    if (screenName === this.lastScreen) return;
    try {
      const a = await this.getAnalyticsClient();
      if (a) {
        if (screenName === this.lastScreen) return;
        this.lastScreen = screenName;
        await a().logScreenView({ screen_name: screenName, screen_class: screenClass || screenName });
      }
    } catch (e) {}
  }

  // App open
  async logAppOpen(): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logAppOpen();
    } catch (e) {}
  }

  // App launch source (normal / quick_action / siri / assistant)
  async logAppLaunch(launchSource: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('app_launch', {
        launch_source: launchSource,
        platform: Platform.OS,
      });
    } catch (e) {}
  }

  // Cold start duration: JS start → splash hidden (ms)
  async logStartupTime(durationMs: number): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('app_startup_time', {
        duration_ms: Math.round(durationMs),
        platform: Platform.OS,
      });
    } catch (e) {}
  }

  // Station play
  async logStationPlay(stationId: string, stationName: string, genre?: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('station_play', {
        station_id: stationId,
        station_name: stationName.substring(0, 100),
        genre: genre || 'unknown',
        platform: Platform.OS,
      });
    } catch (e) {}
  }

  // Station favorite
  async logStationFavorite(stationId: string, stationName: string, isFavorite: boolean): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('station_favorite', {
        station_id: stationId,
        station_name: stationName.substring(0, 100),
        action: isFavorite ? 'add' : 'remove',
      });
    } catch (e) {}
  }

  // Premium purchase
  async logPremiumPurchase(productId: string, price?: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('premium_purchase', {
        product_id: productId,
        price: price || 'unknown',
        platform: Platform.OS,
      });
    } catch (e) {}
  }

  // Premium paywall view
  async logPaywallView(source: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('paywall_view', { source, platform: Platform.OS });
    } catch (e) {}
  }

  // Ad watched
  async logAdWatched(adType: string, stationId?: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('ad_watched', { ad_type: adType, station_id: stationId || 'none', platform: Platform.OS });
    } catch (e) {}
  }

  // Search
  async logSearch(searchTerm: string, resultsCount: number): Promise<void> {
    // Searches can include names/emails. Only retain buckets and result counts.
    await this.logDiagnosticEvent('search_results', searchMetrics(searchTerm, resultsCount));
  }

  // Genre browse
  async logGenreBrowse(genreName: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('genre_browse', { genre_name: genreName });
    } catch (e) {}
  }

  // CarPlay / Android Auto connect
  async logCarConnect(platform: 'carplay' | 'android_auto'): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logEvent('car_connect', { car_platform: platform });
    } catch (e) {}
  }

  // User login
  async logLogin(method: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logLogin({ method });
    } catch (e) {}
  }

  // User signup
  async logSignUp(method: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().logSignUp({ method });
    } catch (e) {}
  }

  // Set user properties
  async setUserId(userId: string | null): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().setUserId(userId && /^[A-Za-z0-9_-]{1,100}$/.test(userId) ? userId : null);
    } catch (e) {}
  }

  async setUserProperty(name: string, value: string): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().setUserProperty(name, value);
    } catch (e) {}
  }

  async setIsPremium(isPremium: boolean): Promise<void> {
    try {
      const a = await this.getAnalyticsClient();
      if (a) await a().setUserProperty('is_premium', isPremium ? 'true' : 'false');
    } catch (e) {}
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
