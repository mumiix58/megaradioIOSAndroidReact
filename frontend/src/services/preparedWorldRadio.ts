import { worldCountryKeys } from '../utils/worldCountryRotation';
import { worldCountryRotation, worldRadioHistory } from './worldRadioHistory';
import type { Station } from '../types';
import { drawWorldRadio } from './carRadioService';
import { verifyWorldRadio } from './worldRadioValidation';

/** Small verified reserve; one discovery job at a time, no permanently open streams. */
export class PreparedWorldRadio {
  private ready: { station: Station; at: number }[] = [];
  private pending: Promise<void> | null = null;
  private controller = new AbortController();
  private excluded = new Set<string>();
  private consumed = new Set<string>();
  private takenCountries: string[][] = [];
  constructor(private draw = drawWorldRadio, private now = Date.now, private verify = verifyWorldRadio, private capacity = 3) {}
  private prune(excluded: Set<string>) {
    this.excluded = new Set([...excluded, ...this.consumed]);
    const countries = new Set([...worldCountryRotation.blocked(), ...this.takenCountries.flat()]);
    this.ready = this.ready.filter(item => !this.excluded.has(item.station._id) && !worldRadioHistory.has(item.station) && !worldCountryKeys(item.station).some(key => countries.has(key)));
  }
  async prepare(excluded: Set<string>) {
    if (this.controller.signal.aborted) return;
    this.prune(excluded);
    if (this.pending) return this.pending;
    if (this.ready.length >= this.capacity && this.ready.every(item => this.now() - item.at < 15000)) return;
    const stale = this.ready.findIndex(item => this.now() - item.at >= 15000);
    const previous = stale >= 0 ? this.ready.splice(stale, 1)[0] : null;
    const blocked = new Set([...this.excluded, ...this.ready.map(item => item.station._id)]);
    const countries = new Set([...worldCountryRotation.blocked(), ...this.takenCountries.flat(), ...this.ready.flatMap(item => worldCountryKeys(item.station))]);
    let found = false;
    const pending = (async () => {
      try {
        const refreshed = previous ? await this.verify(previous.station, this.controller.signal) : null;
        const station = refreshed || (!this.controller.signal.aborted ? await this.draw(blocked, Math.random, this.controller.signal, countries) : null);
        if (station && !this.controller.signal.aborted && !this.excluded.has(station._id) && !worldRadioHistory.has(station)
          && !worldCountryKeys(station).some(key => countries.has(key) || worldCountryRotation.blocked().has(key) || this.takenCountries.some(keys => keys.includes(key)))) {
          this.ready.push({ station, at: this.now() }); found = true;
        }
      } catch { /* A failed warmup never changes playback or starts a retry loop. */ }
    })();
    this.pending = pending;
    try { await pending; } finally {
      if (this.pending === pending) {
        this.pending = null;
        // Fill the reserve in the background, without holding up the first result.
        if (found && this.ready.length < this.capacity && !this.controller.signal.aborted) void this.prepare(this.excluded);
      }
    }
  }
  async take(excluded: Set<string>) {
    for (let attempt = 0; attempt < 3 && !this.controller.signal.aborted; attempt++) {
      this.prune(excluded);
      const index = this.ready.findIndex(item => this.now() - item.at < 15000);
      if (index >= 0) {
        const { station } = this.ready.splice(index, 1)[0];
        const country = worldCountryKeys(station);
        if (country.length) this.takenCountries = [...this.takenCountries, country].slice(-8);
        this.consumed.add(station._id);
        if (this.consumed.size > 16) this.consumed.delete(this.consumed.values().next().value!);
        // A ready choice returns immediately even if another decoder is still checking.
        void this.prepare(excluded);
        return station;
      }
      await this.prepare(excluded);
    }
    return null;
  }
  dispose() { this.controller.abort(); this.ready = []; this.consumed.clear(); this.takenCountries = []; }
}
