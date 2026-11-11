import type { Station } from '../types';

/** Match catalog aliases as well as IDs; stream query parameters may identify a station. */
export function worldRadioKeys(station: Station): string[] {
  const keys = station._id ? [`id:${station._id}`] : [];
  const name = station.name?.normalize('NFKC').toLocaleLowerCase('en')
    .replace(/\b\d+\s*k(?:bps|bit\/s|bit|b)\b/gi, '')
    .replace(/\b(?:aac\+?|mp3|opus|hq|hd)\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const country = (station.countryCode || station.countrycode || station.country || '').toLowerCase().trim();
  if (name) keys.push(`name:${country}:${name}`);
  for (const raw of [station.url, station.urlResolved, station.url_resolved]) {
    if (!raw) continue;
    const url = raw.match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i);
    if (!url) continue;
    const query = (url[3] || '').split('&').filter(Boolean).filter(part => {
      let key = part.split('=')[0];
      try { key = decodeURIComponent(key); } catch { /* Preserve malformed parameters. */ }
      return !/^(?:token|auth|signature|expires|timestamp|ts|utm_.*)$/i.test(key);
    }).sort().join('&');
    keys.push(`stream:${url[1].toLowerCase()}${url[2].replace(/\/$/, '')}${query ? '?' + query : ''}`);
  }
  return [...new Set(keys)];
}

export class WorldRadioHistory {
  private entries: string[][] = [];
  private keys = new Set<string>();
  constructor(private limit = 1000) {}
  has(station: Station) { return worldRadioKeys(station).some(key => this.keys.has(key)); }
  remember(station: Station) {
    const keys = worldRadioKeys(station);
    this.restore([...this.entries, keys]);
  }
  restore(entries: unknown) {
    if (!Array.isArray(entries)) return;
    const rows = entries.filter((row): row is string[] => Array.isArray(row) && row.length > 0 && row.length <= 8 && row.every(key => typeof key === 'string' && key.length <= 2048));
    const kept: string[][] = [], seen = new Set<string>();
    for (let index = rows.length - 1; index >= 0 && kept.length < this.limit; index--) {
      const row = rows[index];
      if (row.some(key => seen.has(key))) continue;
      row.forEach(key => seen.add(key)); kept.push(row);
    }
    this.entries = kept.reverse(); this.keys = seen;
  }
  snapshot() { return this.entries.map(row => [...row]); }
}
