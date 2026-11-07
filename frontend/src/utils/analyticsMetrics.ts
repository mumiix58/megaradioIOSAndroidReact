// Pure telemetry transformations: no native modules, network calls or user data.
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export type MetricParameters = Record<string, string | number>;
export type MetricEvent = { name: string; parameters: MetricParameters };

const SCREENS = new Set([
  'discover', 'favorites', 'profile', 'genres', 'records', 'search', 'player',
  'onboarding', 'login', 'signup', 'auth-options', 'forgot-password', 'statistics',
  'play-at-login', 'followers', 'follows', 'user-profile', 'open-link', 'link-error',
  'languages', 'genre-detail', 'all-stations', 'notifications', 'users',
  'public-profiles', 'nearby-stations', 'song-history', 'static-page', '+not-found',
]);

// Expo route segments are templates. Never forward paths, query strings or IDs.
export function analyticsScreen(segments: readonly string[]): string {
  const route = segments.filter(segment => !segment.startsWith('('))[0];
  if (!route || route === 'index') return 'home';
  return SCREENS.has(route) ? route.replace(/[-+]/g, '_') : 'other';
}

export function searchMetrics(query: string, results: number): MetricParameters {
  const length = query.trim().length;
  return {
    query_length_bucket: length === 0 ? 'empty' : length <= 3 ? '1_3' : length <= 10 ? '4_10' : '11_plus',
    results_count: Math.max(0, Math.min(10000, Number.isFinite(results) ? Math.floor(results) : 0)),
    has_results: Number.isFinite(results) && results > 0 ? 1 : 0,
  };
}

// IDs are catalog identifiers only. URLs, emails and arbitrary messages fail closed.
export function analyticsCatalogId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : 'unknown';
}

export function analyticsLanguage(value: unknown): string {
  return typeof value === 'string' && /^[a-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/.test(value) ? value : 'unknown';
}

export class PlaybackMetrics {
  private stationId: string | null = null;
  private state: PlaybackStatus = 'idle';
  private foreground = true;
  private lastAt: number | null = null;
  private selectedAt = 0;
  private startupKnown = false;
  private started = false;
  private playedMs = 0;
  private bufferedMs = 0;
  private bufferCount = 0;
  private droppedSamples = 0;

  // The observer samples every 30s. Delayed/suspended JS is not listening time.
  private sample(now: number): void {
    if (this.lastAt !== null && this.foreground && this.stationId) {
      const delta = now - this.lastAt;
      if (delta >= 0 && delta <= 60000) {
        if (this.state === 'playing') this.playedMs += delta;
        if (this.state === 'buffering' && this.started) this.bufferedMs += delta;
      } else if (this.state === 'playing' || this.state === 'buffering') {
        this.droppedSamples++;
      }
    }
    this.lastAt = now;
  }

  private summary(reason: string): MetricEvent[] {
    const events: MetricEvent[] = [];
    if (this.stationId && (this.playedMs > 0 || this.bufferedMs > 0 || this.bufferCount > 0 || this.droppedSamples > 0)) {
      events.push({ name: 'foreground_playback_summary', parameters: {
        station_id: this.stationId,
        foreground_play_ms: Math.round(this.playedMs),
        foreground_buffer_ms: Math.round(this.bufferedMs),
        rebuffer_count: this.bufferCount,
        dropped_time_samples: this.droppedSamples,
        end_reason: reason,
      } });
    }
    this.playedMs = this.bufferedMs = this.bufferCount = this.droppedSamples = 0;
    return events;
  }

  tick(now: number): MetricEvent[] {
    this.sample(now);
    // Bound loss when an OS kills the app without a final lifecycle callback.
    return this.playedMs + this.bufferedMs >= 300000 ? this.summary('checkpoint') : [];
  }

  setForeground(active: boolean, now: number): MetricEvent[] {
    this.sample(now);
    if (active === this.foreground) return [];
    this.foreground = active;
    if (!active) this.startupKnown = false;
    return active ? [] : this.summary('background');
  }

  update(stationId: string | null, state: PlaybackStatus, now: number, initial = false): MetricEvent[] {
    this.sample(now);
    const events: MetricEvent[] = [];
    const id = stationId === null ? null : analyticsCatalogId(stationId);
    if (id !== this.stationId) {
      events.push(...this.summary(id ? 'station_changed' : 'cleared'));
      this.stationId = id;
      this.selectedAt = now;
      this.started = false;
      this.startupKnown = !initial && this.foreground;
      this.state = 'idle';
      if (id && !initial) events.push({ name: 'station_selected', parameters: { station_id: id } });
    }
    const previous = this.state;
    this.state = state;
    if (!id || (state === previous && !initial)) return events;

    // Loading is also entered for a same-station retry after failure.
    if (state === 'loading' && (previous === 'error' || (previous === 'idle' && this.started))) {
      this.selectedAt = now;
      this.started = false;
      this.startupKnown = this.foreground;
    }
    if (state === 'playing' && !this.started) {
      this.started = true;
      const parameters: MetricParameters = { station_id: id, timing_available: this.startupKnown ? 1 : 0 };
      if (this.startupKnown) parameters.startup_ms = Math.round(Math.max(0, Math.min(120000, now - this.selectedAt)));
      events.push({ name: 'playback_started', parameters });
    }
    if (state === 'buffering' && this.started && this.foreground) this.bufferCount++;
    if (state === 'error') {
      events.push({ name: 'playback_failed', parameters: { station_id: id, failure_phase: this.started ? 'after_start' : 'before_start' } });
      events.push(...this.summary('error'));
    } else if (state === 'paused') {
      if (!this.started) this.startupKnown = false;
      events.push(...this.summary('paused'));
    } else if (state === 'idle' && this.started) {
      events.push(...this.summary('stopped'));
    }
    return events;
  }
}
