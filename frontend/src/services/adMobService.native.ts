// adMobService.ts
// Google AdMob Integration Service for MegaRadio
// Handles Interstitial and Rewarded ads

import { AppState, Platform, NativeModules, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepareAdConsent } from '../utils/adConsent';
import { AD_POLICY, canShowStationAd } from '../utils/adPolicy';

// Storage keys
const AD_FREE_UNTIL_KEY = '@megaradio_ad_free_until';
const LAST_FULL_SCREEN_KEY = '@megaradio_last_full_screen_ad';

// Ad Unit IDs (Production)
const AD_UNITS = {
  ios: {
    interstitial: 'ca-app-pub-8771434485570434/6008042825',
    appOpenInterstitial: 'ca-app-pub-8771434485570434/4798357761', // First-launch interstitial
    rewarded: 'ca-app-pub-8771434485570434/3488497756',
  },
  android: {
    interstitial: 'ca-app-pub-8771434485570434/7220363780',
    appOpenInterstitial: 'ca-app-pub-8771434485570434/5958578925',
    rewarded: 'ca-app-pub-8771434485570434/8745886806',
  },
};

class AdMobService {
  private interstitialAd: any = null;
  private rewardedAd: any = null;
  private appOpenAd: any = null;
  private isInterstitialLoaded = false;
  private isRewardedLoaded = false;
  private isAppOpenLoaded = false;
  isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private privacyOptionsOpen = false;
  private stationChangeCount = 0;
  private rewardedAdFreeUntil = 0;
  firstStationAdShown = false; // Per-session flag for first station rewarded ad
  private sessionStartedAt = Date.now();
  private lastFullScreenAt = 0;
  private automaticAdsThisSession = 0;
  private showing = false;
  private presentation: Promise<{ shown: boolean; reward?: { type: string; amount: number } }> | null = null;
  private retryTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private retryAttempts: Record<string, number> = {};

  private metric(name: string, format: 'interstitial' | 'rewarded', code?: string): void {
    try {
      const { analyticsService } = require('./analyticsService');
      void analyticsService.logDiagnosticEvent(name, {
        ad_format: format, placement: format === 'rewarded' ? 'profile_opt_in' : 'station_switch',
        ...(code ? { error_code: String(code).slice(0, 60) } : {}),
      }).catch(() => {});
    } catch { /* Advertising remains available if telemetry is unavailable. */ }
  }

  // Get the correct ad unit ID based on platform and environment
  getAdUnitId(type: 'interstitial' | 'rewarded' | 'appOpenInterstitial'): string {
    if (__DEV__) {
      const { TestIds } = require('react-native-google-mobile-ads');
      return type === 'appOpenInterstitial' ? TestIds.APP_OPEN
        : type === 'rewarded' ? TestIds.REWARDED_INTERSTITIAL
        : TestIds.INTERSTITIAL;
    }
    
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    return AD_UNITS[platform][type];
  }

  // Initialize AdMob SDK
  async initialize(): Promise<boolean> {
    if (this.privacyOptionsOpen) return false;
    if (this.isInitialized) return true;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.initializeOnce();
    try { return await this.initializationPromise; }
    finally { this.initializationPromise = null; }
  }

  async requiresPrivacyOptions(): Promise<boolean> {
    if (this.initializationPromise) await this.initializationPromise;
    const { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } = require('react-native-google-mobile-ads');
    return (await AdsConsent.getConsentInfo()).privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  }

  async showPrivacyOptions(): Promise<void> {
    if (this.privacyOptionsOpen) return;
    if (this.initializationPromise) await this.initializationPromise;
    if (this.privacyOptionsOpen) return;
    if (this.showing) return;
    this.privacyOptionsOpen = true;
    Object.values(this.retryTimers).forEach(clearTimeout);
    this.retryTimers = {};
    this.isInitialized = false;
    // Discard requests made under the old choices before presenting the form.
    for (const ad of [this.interstitialAd, this.rewardedAd, this.appOpenAd]) {
      try { ad?.removeAllListeners(); } catch { /* Already disposed. */ }
    }
    this.interstitialAd = this.rewardedAd = this.appOpenAd = null;
    this.isInterstitialLoaded = this.isRewardedLoaded = this.isAppOpenLoaded = false;
    try {
      const { AdsConsent } = require('react-native-google-mobile-ads');
      await AdsConsent.showPrivacyOptionsForm();
    } finally {
      this.privacyOptionsOpen = false;
      // Re-read UMP before creating any replacement ad request.
      await this.initialize();
    }
  }

  private async initializeOnce(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[AdMob] Not available on web');
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      const mobileAds = require('react-native-google-mobile-ads').default;
      const { MaxAdContentRating } = require('react-native-google-mobile-ads');
      
      // The non-personalized flag belongs on each ad request, not this SDK configuration.
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.T,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        console.log('[AdMob] Request configuration set (non-personalized ads enabled)');
      } catch (configError) {
        console.error('[AdMob] Request configuration error (non-fatal):', configError);
      }
      
      const { AdsConsent } = require('react-native-google-mobile-ads');
      const attModule = NativeModules.ATTModule;
      const canRequestAds = await prepareAdConsent(
        Platform.OS,
        attModule ? () => attModule.requestPermission() : undefined,
        AdsConsent,
      );
      if (!canRequestAds) {
        console.log('[AdMob] Ads remain disabled until privacy requirements are resolved');
        return false;
      }

      await mobileAds().initialize();
      console.log('[AdMob] SDK initialized successfully');
      
      this.isInitialized = true;
      
      try {
        const storedLastAd = Number(await AsyncStorage.getItem(LAST_FULL_SCREEN_KEY));
        if (Number.isFinite(storedLastAd) && storedLastAd > 0 && storedLastAd <= Date.now()) {
          this.lastFullScreenAt = Math.max(this.lastFullScreenAt, storedLastAd);
        }
      } catch { /* The session grace and cap still protect users. */ }
      // No launch ads: the first listening experience stays uninterrupted.
      void this.loadInterstitialAd();
      void this.loadRewardedAd();

      return true;
    } catch (error) {
      console.error('[AdMob] Initialization error:', error);
      return false;
    }
  }

  // Load Interstitial Ad
  async loadInterstitialAd(): Promise<void> {
    if (Platform.OS === 'web' || !this.isInitialized) return;

    try {
      const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
      
      // CRITICAL: Clean up old instance before creating new one
      if (this.interstitialAd) {
        try {
          this.interstitialAd.removeAllListeners();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.interstitialAd = null;
      }
      this.isInterstitialLoaded = false;
      
      const adUnitId = this.getAdUnitId('interstitial');
      console.log('[AdMob] Loading interstitial with adUnitId:', adUnitId);
      
      this.interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ['music', 'radio', 'streaming', 'entertainment'],
      });

      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AdMob] Interstitial ad LOADED successfully');
        this.isInterstitialLoaded = true;
        this.retryAttempts.interstitial = 0;
        this.metric('ad_load_succeeded', 'interstitial');
      });

      // iOS: Hide status bar when ad opens to prevent display issues
      this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[AdMob] Interstitial ad OPENED');
        if (Platform.OS === 'ios') {
          StatusBar.setHidden(true);
        }
      });

      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Interstitial ad closed by user');
        if (Platform.OS === 'ios') {
          StatusBar.setHidden(false);
        }
        this.isInterstitialLoaded = false;
        // The next station boundary preloads a replacement.
      });

      this.interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error('[AdMob] Interstitial ad ERROR:', error?.message || error);
        this.isInterstitialLoaded = false;
        this.metric('ad_load_failed', 'interstitial', error?.code || 'unknown');
        this.retryLoad('interstitial');
      });

      this.metric('ad_load_requested', 'interstitial');
      this.interstitialAd.load();
    } catch (error) {
      console.error('[AdMob] Error creating interstitial:', error);
    }
  }

  // Kept for compatibility with older callers. Never show a full-screen ad
  // after launch or after playback has already started.
  async loadAppOpenAd(): Promise<void> {}
  async showAppOpenAd(): Promise<boolean> { return false; }

  private retryLoad(kind: 'interstitial' | 'rewarded'): void {
    if (!this.isInitialized || this.privacyOptionsOpen || this.retryTimers[kind]) return;
    const attempt = (this.retryAttempts[kind] || 0) + 1;
    this.retryAttempts[kind] = attempt;
    // Bounded retries prevent an offline/no-fill loop from churning the SDK.
    if (attempt > 3) return;
    this.retryTimers[kind] = setTimeout(() => {
      delete this.retryTimers[kind];
      if (kind === 'interstitial') void this.loadInterstitialAd();
      else void this.loadRewardedAd();
    }, Math.min(60000, 15000 * 2 ** (attempt - 1)));
  }

  // Load Rewarded Interstitial Ad
  async loadRewardedAd(): Promise<void> {
    if (Platform.OS === 'web' || !this.isInitialized) return;

    try {
      const { RewardedInterstitialAd, RewardedAdEventType, AdEventType } = require('react-native-google-mobile-ads');
      
      // CRITICAL: Clean up old instance before creating new one
      if (this.rewardedAd) {
        try {
          this.rewardedAd.removeAllListeners();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.rewardedAd = null;
      }
      this.isRewardedLoaded = false;
      
      const adUnitId = this.getAdUnitId('rewarded');
      console.log('[AdMob] Loading rewarded interstitial with adUnitId:', adUnitId);
      
      this.rewardedAd = RewardedInterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ['music', 'radio', 'streaming', 'entertainment'],
      });

      // RewardedInterstitialAd requires RewardedAdEventType for LOADED
      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[AdMob] Rewarded interstitial ad LOADED successfully');
        this.isRewardedLoaded = true;
        this.retryAttempts.rewarded = 0;
        this.metric('ad_load_succeeded', 'rewarded');
      });

      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error('[AdMob] Rewarded load error:', error?.message || error);
        this.isRewardedLoaded = false;
        this.metric('ad_load_failed', 'rewarded', error?.code || 'unknown');
        this.retryLoad('rewarded');
      });

      this.metric('ad_load_requested', 'rewarded');
      this.rewardedAd.load();
    } catch (error) {
      console.error('[AdMob] Error creating rewarded interstitial ad:', error);
    }
  }

  // Check if user has ad-free time remaining OR has premium/remove-ads plan
  async isAdFree(): Promise<boolean> {
    try {
      // Check premium status first (permanent ad removal)
      const { usePremiumStore } = require('../store/premiumStore');
      const premiumState = usePremiumStore.getState();
      if (premiumState.hasFeature('remove_ads')) {
        return true;
      }
    } catch (e) {
      // PremiumStore not available - continue with regular check
    }
    
    if (Date.now() < this.rewardedAdFreeUntil) return true;
    try {
      const adFreeUntil = await AsyncStorage.getItem(AD_FREE_UNTIL_KEY);
      const expiryTime = Number(adFreeUntil);
      return Number.isFinite(expiryTime) && Date.now() < expiryTime;
    } catch (error) {
      return false;
    }
  }

  // Get remaining ad-free time in minutes
  async getAdFreeMinutesRemaining(): Promise<number> {
    let expiry = this.rewardedAdFreeUntil;
    try {
      const stored = Number(await AsyncStorage.getItem(AD_FREE_UNTIL_KEY));
      if (Number.isFinite(stored)) expiry = Math.max(expiry, stored);
    } catch { /* An earned in-session reward survives a storage error. */ }
    return Math.max(0, Math.ceil((expiry - Date.now()) / 60000));
  }

  async grantAdFreeTime(minutes: number = AD_POLICY.rewardedMinutes): Promise<void> {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    let expiry = this.rewardedAdFreeUntil;
    try {
      const stored = Number(await AsyncStorage.getItem(AD_FREE_UNTIL_KEY));
      if (Number.isFinite(stored)) expiry = Math.max(expiry, stored);
    } catch { /* Reward still works in this session. */ }
    this.rewardedAdFreeUntil = Math.max(expiry, Date.now()) + minutes * 60000;
    try { await AsyncStorage.setItem(AD_FREE_UNTIL_KEY, String(this.rewardedAdFreeUntil)); }
    catch { /* Do not take away a completed reward because storage is unavailable. */ }
  }

  // Called and awaited only at a foreground, user-initiated station switch.
  // Headless lock-screen navigation never accumulates advertising debt.
  async waitForPresentation(): Promise<void> {
    if (this.presentation) await this.presentation;
  }

  async onStationChange(): Promise<boolean> {
    if (this.showing) { await this.presentation; return false; }
    if (!this.isInitialized || AppState.currentState !== 'active') return false;
    if (!this.firstStationAdShown) {
      this.firstStationAdShown = true;
      return false; // The first station is not a station change.
    }
    this.stationChangeCount++;
    return this.showInterstitialAd();
  }

  async showInterstitialAd(): Promise<boolean> {
    const adFree = await this.isAdFree();
    if (this.showing) { await this.presentation; return false; }
    if (!this.isInitialized || !canShowStationAd({
      now: Date.now(), sessionStartedAt: this.sessionStartedAt,
      lastFullScreenAt: this.lastFullScreenAt, stationChanges: this.stationChangeCount,
      automaticAdsThisSession: this.automaticAdsThisSession,
      foreground: AppState.currentState === 'active', adFree, showing: this.showing,
    })) return false;
    const ad = this.interstitialAd;
    if (!this.isInterstitialLoaded || !ad) {
      if (!this.retryTimers.interstitial) void this.loadInterstitialAd();
      return false; // No reward-ad fallback and no waiting for inventory.
    }
    this.showing = true;
    this.isInterstitialLoaded = false;
    this.presentation = this.presentAd(ad, false);
    const result = await this.presentation;
    this.presentation = null;
    this.showing = false;
    if (result.shown) {
      this.stationChangeCount = 0;
      this.automaticAdsThisSession++;
      await this.recordFullScreen();
    }
    return result.shown;
  }

  // Reward ads are exclusively opt-in. Their completion gives 30 minutes of
  // app-ad-free time; broadcaster advertisements cannot be removed.
  async showRewardedAd(): Promise<{ success: boolean; reward?: { type: string; amount: number } }> {
    if (!this.isInitialized || this.privacyOptionsOpen || this.showing ||
        AppState.currentState !== 'active' || !this.isRewardedAdReady()) return { success: false };
    const { usePremiumStore } = require('../store/premiumStore');
    if (usePremiumStore.getState().hasFeature('remove_ads')) return { success: false };
    this.showing = true;
    const ad = this.rewardedAd;
    this.isRewardedLoaded = false;
    this.presentation = this.presentAd(ad, true);
    const result = await this.presentation;
    this.presentation = null;
    this.showing = false;
    if (result.shown) await this.recordFullScreen();
    void this.loadRewardedAd();
    return { success: !!result.reward, reward: result.reward };
  }

  private async recordFullScreen(): Promise<void> {
    this.lastFullScreenAt = Date.now();
    try { await AsyncStorage.setItem(LAST_FULL_SCREEN_KEY, String(this.lastFullScreenAt)); }
    catch { /* Session cap still applies if storage is unavailable. */ }
  }

  private async presentAd(ad: any, rewarded: boolean): Promise<{
    shown: boolean; reward?: { type: string; amount: number };
  }> {
    const { AdEventType, RewardedAdEventType } = require('react-native-google-mobile-ads');
    let player: any;
    let pausedTrack: string | number | undefined;
    try {
      player = require('react-native-track-player').default;
      const state = await player.getPlaybackState();
      if (state.state === 'playing') {
        pausedTrack = (await player.getActiveTrack())?.id;
        await player.pause();
      }
    } catch { /* Advertising must not depend on an optional player API. */ }
    if (AppState.currentState !== 'active' || await this.isAdFree() && !rewarded) {
      if (pausedTrack !== undefined) { try { await player.play(); } catch {} }
      return { shown: false };
    }
    try {
      return await new Promise<{ shown: boolean; reward?: { type: string; amount: number } }>(resolve => {
        let finished = false;
        let shown = false;
        let reward: { type: string; amount: number } | undefined;
        let rewardSaved: Promise<void> = Promise.resolve();
        const listeners: (() => void)[] = [];
        const format = rewarded ? 'rewarded' : 'interstitial';
        this.metric('ad_show_requested', format);
        const finish = async () => {
          if (finished) return;
          finished = true;
          listeners.forEach(remove => remove());
          if (Platform.OS === 'ios') StatusBar.setHidden(false);
          this.metric(shown ? 'ad_dismissed' : 'ad_show_failed', format);
          await rewardSaved;
          resolve({ shown, reward });
        };
        listeners.push(ad.addAdEventListener(AdEventType.OPENED, () => {
          shown = true;
          this.metric('ad_shown', format);
          if (Platform.OS === 'ios') StatusBar.setHidden(true);
        }));
        listeners.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
        listeners.push(ad.addAdEventListener(AdEventType.ERROR, finish));
        if (rewarded) listeners.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (value: { type: string; amount: number }) => {
          if (reward || finished) return;
          reward = value;
          this.metric('ad_reward_earned', 'rewarded');
          rewardSaved = this.grantAdFreeTime(AD_POLICY.rewardedMinutes);
        }));
        try { Promise.resolve(ad.show()).catch(finish); }
        catch { void finish(); }
      });
    } finally {
      if (rewarded && pausedTrack !== undefined) {
        try {
          // Never restart a different station selected while the ad was open.
          if ((await player.getActiveTrack())?.id === pausedTrack) await player.play();
        } catch { /* The next explicit playback action can recover. */ }
      }
    }
  }

  // Check if rewarded ad is ready
  isRewardedAdReady(): boolean {
    return this.isRewardedLoaded && this.rewardedAd !== null;
  }

  // Check if first station rewarded ad should be shown (per session)
  shouldShowFirstStationAd(): boolean {
    return false; // No automatic first-station reward ad.
  }

  // Mark first station ad as shown (per session)
  markFirstStationAdShown(): void {
    this.firstStationAdShown = true;
  }

  // Check if interstitial ad is ready
  isInterstitialAdReady(): boolean {
    return this.isInterstitialLoaded && this.interstitialAd !== null;
  }
}

// Export singleton instance
export const adMobService = new AdMobService();
export default adMobService;
