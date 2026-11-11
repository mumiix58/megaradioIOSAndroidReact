import { AppState } from 'react-native';
import crashlyticsService from './crashlyticsService';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { usePremiumStore } from '../store/premiumStore';
import { useLanguageStore } from '../store/languageStore';
import { analyticsLanguage, PlaybackMetrics, type MetricEvent, type MetricParameters } from '../utils/analyticsMetrics';

interface AnalyticsSink {
  logDiagnosticEvent: (name: string, parameters: MetricParameters) => Promise<void>;
  setUserProperty: (name: string, value: string) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
}

// Store subscriptions avoid rerenders and never log per-progress/per-volume updates.
// Phone/tablet only: the native TV, desktop and watch targets have separate runtimes.
export function observeMobileAnalytics(sink: AnalyticsSink): () => void {
  const playback = new PlaybackMetrics();
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const emit = (events: MetricEvent[]) => {
    for (const event of events) void sink.logDiagnosticEvent(event.name, event.parameters);
  };
  const subscriptions: (() => void)[] = [];
  let lifecycle: { remove: () => void } | undefined;
  let sampling: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => {
    if (sampling !== undefined) clearInterval(sampling);
    lifecycle?.remove();
    subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
  };
  try {
    const player = usePlayerStore.getState();
    playback.setForeground(AppState.currentState === 'active', now());
    emit(playback.update(player.currentStation?._id || null, player.playbackState, now(), true));

    subscriptions.push(usePlayerStore.subscribe((state, previous) => {
        if (state.currentStation?._id !== previous.currentStation?._id || state.playbackState !== previous.playbackState) {
          emit(playback.update(state.currentStation?._id || null, state.playbackState, now()));
        }
        if (state.sleepTimerActive && !previous.sleepTimerActive) {
          void sink.logDiagnosticEvent('sleep_timer_started', {
            duration_minutes: Math.max(1, Math.min(1440, Math.round(state.sleepTimerRemaining / 60))),
          });
        }
      }));
    subscriptions.push(useAuthStore.subscribe((state, previous) => {
        if (state.isAuthLoaded && (state.isAuthenticated !== previous.isAuthenticated || state.user?._id !== previous.user?._id || state.user?.id !== previous.user?.id || !previous.isAuthLoaded)) {
          // Clear the previous account at logout/account switch; never use email.
          crashlyticsService.setUserId(state.isAuthenticated ? state.user?._id || state.user?.id || '' : '');
        }
        if (state.isAuthLoaded && (state.isAuthenticated !== previous.isAuthenticated || !previous.isAuthLoaded)) {
          const status = state.isAuthenticated ? 'signed_in' : 'guest';
          // Do not infer a login/signup from session hydration or a cached account.
          void sink.setUserId(null);
          void sink.setUserProperty('auth_status', status);
          void sink.logDiagnosticEvent('auth_state_changed', { auth_status: status });
        }
      }));
    subscriptions.push(usePremiumStore.subscribe((state, previous) => {
        if (state.plan !== previous.plan || state.isPremium !== previous.isPremium || state.isRemoveAds !== previous.isRemoveAds) {
          void sink.setUserProperty('premium_plan', state.plan);
          void sink.setUserProperty('is_premium', String(state.isPremium));
          // A restore/cache/server refresh is an entitlement change, never a purchase.
          void sink.logDiagnosticEvent('premium_status_changed', { premium_plan: state.plan, has_ad_free: state.isRemoveAds ? 1 : 0 });
        }
      }));
    subscriptions.push(useLanguageStore.subscribe((state, previous) => {
        if (state.isInitialized && (!previous.isInitialized || state.currentLanguage !== previous.currentLanguage)) {
          void sink.setUserProperty('app_language', analyticsLanguage(state.currentLanguage));
        }
      }));
    const auth = useAuthStore.getState();
    crashlyticsService.setUserId(auth.isAuthLoaded && auth.isAuthenticated ? auth.user?._id || auth.user?.id || '' : '');
    void sink.setUserId(null);
    if (auth.isAuthLoaded) void sink.setUserProperty('auth_status', auth.isAuthenticated ? 'signed_in' : 'guest');
    const premium = usePremiumStore.getState();
    void sink.setUserProperty('premium_plan', premium.plan);
    void sink.setUserProperty('is_premium', String(premium.isPremium));
    const language = useLanguageStore.getState();
    if (language.isInitialized) void sink.setUserProperty('app_language', analyticsLanguage(language.currentLanguage));

    lifecycle = AppState.addEventListener('change', state => emit(playback.setForeground(state === 'active', now())));
    sampling = setInterval(() => emit(playback.tick(now())), 30000);
    return () => {
      cleanup();
      emit(playback.setForeground(false, now()));
    };
  } catch (error) {
    // A retry must never duplicate listeners left by a partial setup.
    cleanup();
    throw error;
  }
}
