import type { Station } from '../types';

export function worldCountryKeys(station: Station): string[] {
  const code = (station.countryCode || station.countrycode || '').trim();
  const keys = /^[a-z]{2}$/i.test(code) && !/^(?:xx|zz)$/i.test(code) ? [code.toUpperCase()] : [];
  const name = (station.country || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!/^(?:unknown|global|all|n\/a|-)?$/.test(name)) keys.push(`name:${name}`);
  return keys;
}

/** An eight-draw cooldown gives every ten successful draws at least nine countries. */
export class WorldCountryRotation {
  private recent: string[][] = [];
  blocked() { return new Set(this.recent.flat()); }
  remember(station: Station) {
    const country = worldCountryKeys(station);
    if (country.length) this.recent = [...this.recent, country].slice(-8);
  }
}

export const worldCountryKey = (station: Station) => worldCountryKeys(station)[0] || '';
