import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { usePlayerStore } from '../store/playerStore';

const KEYS = {
  launches: '@rateus/launches',
  sessions: '@rateus/completed_listening_sessions',
  lastRequest: '@rateus/last_requested',
  legacyLastShown: '@rateus/last_shown',
};
const MIN_LAUNCHES = 3;
const MIN_SESSIONS = 3;
const MIN_LISTENING_MS = 2 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

/** Count foreground playback, then request neutrally after a completed session. */
export class RateUsService {
  private listeners = new Set<() => void>();
  private stopPlayer?: () => void;
  private stopAppState?: () => void;
  private playingSince: number | null = null;
  private listeningMs = 0;
  private stationId: string | null = null;
  private foreground = AppState.currentState === 'active';
  private requestInFlight = false;
  private completedSessionQueue: Promise<void> = Promise.resolve();

  onShouldShow(callback: () => void): () => void {
    this.listeners.add(callback);
    if (!this.stopPlayer && Platform.OS !== 'web') this.observePlayback();
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopPlayer?.();
        this.stopAppState?.();
        this.stopPlayer = undefined;
        this.stopAppState = undefined;
        this.playingSince = null;
        this.listeningMs = 0;
      }
    };
  }

  private async getNumber(key: string): Promise<number> {
    const value = Number(await AsyncStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  async trackAppLaunch(): Promise<void> {
    if (Platform.OS === 'web') return;
    await AsyncStorage.setItem(KEYS.launches, String(await this.getNumber(KEYS.launches) + 1));
    // Launching the app never requests a review.
  }

  /** Compatibility for callers that report play intent before audio succeeds. */
  async trackStationPlay(): Promise<void> {}

  private accumulatePlayingTime(): void {
    if (this.playingSince !== null) {
      this.listeningMs += Math.max(0, Date.now() - this.playingSince);
      this.playingSince = null;
    }
  }

  private observePlayback(): void {
    this.foreground = AppState.currentState === 'active';
    const initial = usePlayerStore.getState();
    this.stationId = initial.currentStation?._id ?? null;
    if (this.foreground && initial.playbackState === 'playing' && this.stationId) {
      this.playingSince = Date.now();
    }
    this.stopPlayer = usePlayerStore.subscribe((state, previous) => {
      const nextStation = state.currentStation?._id ?? null;
      if (state.playbackState === previous.playbackState && nextStation === this.stationId) return;
      this.accumulatePlayingTime();
      if (nextStation !== this.stationId) {
        this.stationId = nextStation;
        this.listeningMs = 0;
      }
      if (state.playbackState === 'error' || state.playbackState === 'idle') {
        this.listeningMs = 0;
      } else if (state.playbackState === 'paused' && previous.playbackState !== 'paused') {
        const meaningful = this.listeningMs >= MIN_LISTENING_MS;
        this.listeningMs = 0;
        if (meaningful) {
          this.completedSessionQueue = this.completedSessionQueue
            .then(() => this.completeListeningSession())
            .catch(() => {});
        }
      }
      if (this.foreground && state.playbackState === 'playing' && this.stationId) {
        this.playingSince = Date.now();
      }
    });
    const subscription = AppState.addEventListener('change', (state) => {
      this.accumulatePlayingTime();
      this.foreground = state === 'active';
      if (this.foreground && usePlayerStore.getState().playbackState === 'playing' && this.stationId) {
        this.playingSince = Date.now();
      }
    });
    this.stopAppState = () => subscription.remove();
  }

  private async completeListeningSession(): Promise<void> {
    await AsyncStorage.setItem(KEYS.sessions, String(await this.getNumber(KEYS.sessions) + 1));
    if (await this.isEligible()) this.listeners.forEach(callback => callback());
  }

  private canPresent(): boolean {
    return Platform.OS !== 'web'
      && AppState.currentState === 'active'
      && usePlayerStore.getState().playbackState === 'paused';
  }

  private async isEligible(): Promise<boolean> {
    if (!this.canPresent()) return false;
    const [launches, sessions, lastRequest, legacyLastShown] = await Promise.all([
      this.getNumber(KEYS.launches), this.getNumber(KEYS.sessions),
      this.getNumber(KEYS.lastRequest), this.getNumber(KEYS.legacyLastShown),
    ]);
    const lastAttempt = Math.max(lastRequest, legacyLastShown);
    return launches >= MIN_LAUNCHES && sessions >= MIN_SESSIONS
      && (!lastAttempt || Date.now() - lastAttempt >= REQUEST_COOLDOWN_MS)
      && this.canPresent();
  }

  async requestReviewIfEligible(): Promise<void> {
    if (this.requestInFlight) return;
    this.requestInFlight = true;
    try {
      if (!await this.isEligible() || !await StoreReview.isAvailableAsync() || !this.canPresent()) return;
      // Store APIs never tell us whether the prompt appeared or a rating was sent.
      // Persist the attempt first so restarts/concurrent events cannot repeat it.
      await AsyncStorage.setItem(KEYS.lastRequest, String(Date.now()));
      if (!this.canPresent()) return;
      await StoreReview.requestReview();
    } catch {
      // A missing store or exhausted platform quota must not interrupt playback.
    } finally {
      this.requestInFlight = false;
    }
  }

  /** Explicit profile action always has an observable result, unlike native quotas. */
  async openStoreReview(): Promise<void> {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id6759302561?action=write-review'
      : 'https://play.google.com/store/apps/details?id=com.megaradio';
    try {
      await Linking.openURL(url);
      await AsyncStorage.setItem(KEYS.lastRequest, String(Date.now()));
    } catch {
      // Store navigation failure is non-blocking; no rating success is recorded.
    }
  }

  // A manual prompt records an attempt, never an assumed submitted rating.
  async markDismissed():Promise<void>{await AsyncStorage.setItem(KEYS.lastRequest,String(Date.now()));}
  async markRated():Promise<void>{await AsyncStorage.setItem(KEYS.lastRequest,String(Date.now()));}
  async reset(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    this.listeningMs = 0;
    this.playingSince = null;
  }
}

export const rateUsService = new RateUsService();
export default rateUsService;
