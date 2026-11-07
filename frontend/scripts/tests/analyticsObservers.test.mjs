import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { analyticsLanguage, PlaybackMetrics } from '../../src/utils/analyticsMetrics.ts';

function store(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(update) { const previous = state; state = { ...state, ...update }; for (const listener of listeners) listener(state, previous); },
    listeners,
  };
}

function fixture({ failLifecycle = false } = {}) {
  let time = 0;
  const player = store({ currentStation: null, playbackState: 'idle', sleepTimerActive: false });
  const auth = store({ isAuthLoaded: false, isAuthenticated: false });
  const premium = store({ plan: 'none', isPremium: false, isRemoveAds: false });
  const language = store({ isInitialized: true, currentLanguage: 'de' });
  const events = [], properties = [], userIds = [], crashUserIds = [];
  let lifecycle, interval;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../../src/services/analyticsObservers.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports, performance: { now: () => time },
    setInterval(callback) { interval = callback; return 1; }, clearInterval() { interval = null; },
    require(name) {
      if (name === './crashlyticsService') return { default: { setUserId(id) { crashUserIds.push(id); } } };
      if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener(_name, callback) { if (failLifecycle) throw Error('native lifecycle not ready'); lifecycle = callback; return { remove() { lifecycle = null; } }; } } };
      if (name.endsWith('/playerStore')) return { usePlayerStore: player };
      if (name.endsWith('/authStore')) return { useAuthStore: auth };
      if (name.endsWith('/premiumStore')) return { usePremiumStore: premium };
      if (name.endsWith('/languageStore')) return { useLanguageStore: language };
      if (name.endsWith('/analyticsMetrics')) return { analyticsLanguage, PlaybackMetrics };
      throw Error(name);
    },
  });
  let stop, setupError;
  try { stop = exports.observeMobileAnalytics({
    async logDiagnosticEvent(name, parameters) { events.push({ name, ...parameters }); },
    async setUserProperty(name, value) { properties.push([name, value]); },
    async setUserId(id) { userIds.push(id); },
  }); } catch (error) { setupError = error; }
  return { player, auth, premium, language, events, properties, userIds, crashUserIds, stop, setupError,
    at(value) { time = value; }, background() { lifecycle('background'); },
    get interval() { return interval; }, get lifecycle() { return lifecycle; } };
}

test('native-store observer records transitions but ignores metadata/progress/volume churn', () => {
  const f = fixture();
  f.player.set({ currentStation: { _id: 'station-1', name: 'Catalog radio', url: 'https://private.example?token=secret' }, playbackState: 'loading' });
  f.at(1200); f.player.set({ playbackState: 'playing' });
  for (let i = 0; i < 100; i++) f.player.set({ volume: i / 100, nowPlaying: { artist: `artist${i}` } });
  assert.deepEqual(f.events.map(event => event.name), ['station_selected', 'playback_started']);
  assert.equal(f.events[1].startup_ms, 1200);
  f.at(3200); f.background();
  assert.equal(f.events[2].foreground_play_ms, 2000);
  assert.ok(!JSON.stringify(f.events).includes('secret'));
  f.stop();
  assert.equal(f.player.listeners.size, 0);
  assert.equal(f.interval, null);
  assert.equal(f.lifecycle, null);
});

test('restoring an account or subscription emits status, never a purchase or successful login', () => {
  const f = fixture();
  f.auth.set({ isAuthLoaded: true, isAuthenticated: true, user: { _id: 'private-account', email: 'private@example.com' } });
  f.premium.set({ plan: 'premium_yearly', isPremium: true, isRemoveAds: true, ownerId: 'private-account' });
  f.auth.set({ isAuthenticated: false, user: null });
  assert.deepEqual(f.events.map(event => event.name), ['auth_state_changed', 'premium_status_changed', 'auth_state_changed']);
  assert.deepEqual(f.userIds, [null, null, null]);
  assert.ok(!JSON.stringify(f.events).includes('private'));
  assert.deepEqual(f.properties.at(-1), ['auth_status', 'guest']);
  f.stop();
});

test('timer feature usage is emitted once and language changes set only bounded context', () => {
  const f = fixture();
  f.player.set({ sleepTimerActive: true, sleepTimerRemaining: 1800 });
  for (let remaining = 1799; remaining > 1700; remaining--) f.player.set({ sleepTimerRemaining: remaining });
  f.language.set({ currentLanguage: 'tr' });
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].duration_minutes, 30);
  assert.deepEqual(f.properties.at(-1), ['app_language', 'tr']);
  f.language.set({ currentLanguage: 'private@example.com' });
  assert.deepEqual(f.properties.at(-1), ['app_language', 'unknown']);
  f.stop();
});

test('partial native setup failure removes all subscriptions so retries cannot duplicate events', () => {
  const f = fixture({ failLifecycle: true });
  assert.match(f.setupError.message, /native lifecycle/);
  for (const observed of [f.player, f.auth, f.premium, f.language]) assert.equal(observed.listeners.size, 0);
  f.player.set({ currentStation: { _id: 'station-1' }, playbackState: 'playing' });
  assert.equal(f.events.length, 0);
});


test('Crashlytics account ID is cleared on logout and updated on account switch without sending emails', () => {
  const f = fixture();
  f.auth.set({ isAuthLoaded: true, isAuthenticated: true, user: { _id: 'account-one', email: 'private@example.com' } });
  f.auth.set({ user: { id: 'account-two', email: 'other@example.com' } });
  f.auth.set({ isAuthenticated: false, user: null });
  assert.deepEqual(f.crashUserIds, ['', 'account-one', 'account-two', '']);
  assert.ok(!JSON.stringify(f.crashUserIds).includes('@'));
  f.stop();
});
