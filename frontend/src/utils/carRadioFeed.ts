import type { Station } from '../types';

export type RadioPage = { stations: Station[]; totalCount: number };
export const uniqueRadios = (items: Station[]) => [...new Map(items.filter(s => s?._id).map(s => [s._id, s])).values()];
export function shuffledRadios(items: Station[], random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
/** Absolute positions keep both swipe directions stable; new pages never move existing cards. */
export class CarRadioFeed {
  readonly entries = new Map<number, Station>();
  private seen = new Set<string>();
  private pool: Station[] = [];
  private page = 1;
  private exhausted = false;
  private pending: Promise<void> | null = null;
  private center = 0;
  error = false;
  constructor(first: Station | null, private fetchPage: (page: number) => Promise<RadioPage>, private notify: () => void) {
    if (first) { this.entries.set(0, first); this.seen.add(first._id); }
  }
  private fill() {
    for (let distance = 0; distance <= 28; distance++) {
      for (const ordinal of distance ? [this.center + distance, this.center - distance] : [this.center]) {
        if (!this.entries.has(ordinal) && this.pool.length) this.entries.set(ordinal, this.pool.shift()!);
      }
    }
  }
  async ensure(center: number) {
    this.center = center;
    this.fill();
    this.notify();
    if (this.pending) return this.pending;
    if (this.exhausted && this.pool.length < 40) {
      // A small country's catalog is finite. Start a new shuffled pass only after all pages.
      const catalog = uniqueRadios([...this.entries.values(), ...this.pool]);
      if (catalog.length) {
        while (this.pool.length < 100) this.pool.push(...shuffledRadios(catalog));
        this.fill(); this.notify();
      }
      return;
    }
    if (this.pool.length >= 40) return;
    const task = (async () => {
      try {
        // Keep enough lookahead for a fast fling in either direction.
        for (let requests = 0; requests < 3 && this.pool.length < 64 && !this.exhausted; requests++) {
          const data = await this.fetchPage(this.page);
          if (!data.stations.length && data.totalCount > 0) throw new Error('Empty radio page');
          this.error = false;
          this.page++;
          for (const station of shuffledRadios(uniqueRadios(data.stations))) {
            if (!this.seen.has(station._id)) { this.seen.add(station._id); this.pool.push(station); }
          }
          this.exhausted = data.stations.length === 0 || (this.page - 1) * 64 >= data.totalCount;
          this.fill();
          this.notify();
        }
      } catch { this.error = true; this.notify(); }
    })();
    this.pending = task;
    try { await task; } finally { this.pending = null; }
    if (this.exhausted && !this.entries.has(this.center + 8)) await this.ensure(this.center);
  }
  get(ordinal: number) { return this.entries.get(ordinal); }
  replace(ordinal: number, station: Station) { this.entries.set(ordinal, station); this.seen.add(station._id); }
}
