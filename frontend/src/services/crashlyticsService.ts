// Firebase Crashlytics Service for MegaRadio
// Provides crash reporting, error logging, and custom keys for debugging
// Uses lazy loading to avoid web bundling issues
import { Platform } from 'react-native';

let crashlytics: any = null;

// Lazy load crashlytics module (native only)
const getCrashlytics = () => {
  if (crashlytics) return crashlytics;
  if (Platform.OS === 'web') return null;
  try {
    const mod = require('@react-native-firebase/crashlytics');
    crashlytics = mod.default || mod;
    return crashlytics;
  } catch (e) {
    console.warn('[Crashlytics] Firebase Crashlytics not available:', e);
    return null;
  }
};

class CrashlyticsService {
  private initialized = false;
  private initialization: Promise<void> | null = null;
  private globalHandlerInstalled = false;

  // Native setters return promises. A reporting failure must never create a new
  // unhandled rejection while we are already handling an application failure.
  private safely(action: (sdk: any) => unknown): void {
    try {
      const c = getCrashlytics();
      if (c) void Promise.resolve(action(c())).catch(() => {});
    } catch {}
  }

  async initialize(): Promise<void> {
    if (this.initialized || Platform.OS === 'web') return;
    if (!this.initialization) {
      this.initialization = (async () => {
        try {
          const c = getCrashlytics();
          if (!c) return;
          await c().setCrashlyticsCollectionEnabled(true);
          this.initialized = true;
        } catch (error) {
          console.warn('[Crashlytics] Failed to initialize:', error);
        }
      })().finally(() => { this.initialization = null; });
    }
    await this.initialization;
  }

  // Record a non-fatal error
  recordError(error: Error, context?: string): void {
    this.safely(sdk => {
      if (context) this.safely(c => c.log(`[${context}] ${error.message}`));
      return sdk.recordError(error);
    });
  }

  // Log a message (appears in Crashlytics logs for the next crash)
  log(message: string): void {
    this.safely(sdk => sdk.log(message));
  }

  // Use an opaque application ID; callers clear it on logout.
  setUserId(userId: string): void {
    this.safely(sdk => sdk.setUserId(userId));
  }

  setAttribute(key: string, value: string): void {
    this.safely(sdk => sdk.setAttribute(key, value));
  }

  setAttributes(attributes: Record<string, string>): void {
    this.safely(sdk => sdk.setAttributes(attributes));
  }

  // Set premium status for crash filtering
  setIsPremium(isPremium: boolean): void {
    this.setAttribute('is_premium', isPremium ? 'true' : 'false');
  }

  // Set current playing station for crash context
  setCurrentStation(stationId: string, stationName: string): void {
    this.setAttributes({
      current_station_id: stationId,
      current_station_name: stationName.substring(0, 100),
    });
  }

  // Set CarPlay/Android Auto connection state
  setCarPlayConnected(connected: boolean, platform: 'carplay' | 'android_auto'): void {
    this.setAttributes({
      car_connected: connected ? 'true' : 'false',
      car_platform: platform,
    });
  }

  // Force a test crash (for development only)
  testCrash(): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      this.safely(sdk => sdk.crash());
    }
  }

  setupGlobalErrorHandler(): void {
    if (Platform.OS === 'web' || this.globalHandlerInstalled || typeof ErrorUtils === 'undefined') return;
    // Instantiating RNFB installs its own JS fatal handler. Preserve it rather than
    // reporting the same fatal exception again as a second non-fatal issue.
    try {
      const c = getCrashlytics();
      if (c) c();
    } catch {}
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      this.setAttribute('last_js_error_fatal', String(Boolean(isFatal)));
      this.log(`[GlobalError] isFatal=${Boolean(isFatal)}`);
      if (originalHandler) originalHandler(error, isFatal);
      else this.recordError(error, 'GlobalError');
    });
    this.globalHandlerInstalled = true;
  }
}

export const crashlyticsService = new CrashlyticsService();
export default crashlyticsService;
