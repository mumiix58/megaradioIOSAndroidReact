// Keep country decks independent and bounded. No network, image probing or timers.
export type PopularRotationDeck = { signature: string; queue: string[] };
export type PopularRotationSnapshot = [string, PopularRotationDeck][];
export function createPopularStationRotation(maxScopes = 32, initial: PopularRotationSnapshot = [], onChange?: (snapshot: PopularRotationSnapshot) => void) {
  const decks = new Map<string, PopularRotationDeck>(initial.slice(-maxScopes));
  return function next(scope: string, ids: readonly string[], count = 4, countries?: ReadonlyMap<string, string>): string[] {
    const unique = [...new Set(ids.filter(Boolean))].slice(0, 20);
    if (!unique.length || count <= 0) return [];
    const signature = JSON.stringify(countries ? unique.map(id => [id, countries.get(id)]) : unique);
    let deck = decks.get(scope);
    if (!deck || deck.signature !== signature || deck.queue.length !== unique.length || new Set(deck.queue).size !== unique.length || deck.queue.some(id => !unique.includes(id))) deck = { signature, queue: [...unique] };
    decks.delete(scope);
    decks.set(scope, deck);
    if (decks.size > maxScopes) decks.delete(decks.keys().next().value!);
    const selected: string[] = [];
    const seenCountries = new Set<string>();
    for (const id of deck.queue) {
      const country = countries?.get(id);
      if (countries && (!country || seenCountries.has(country))) continue;
      selected.push(id);
      if (country) seenCountries.add(country);
      if (selected.length >= Math.min(count, unique.length)) break;
    }
    deck.queue = [...deck.queue.filter(id => !selected.includes(id)), ...selected];
    onChange?.([...decks].map(([key, value]) => [key, { signature: value.signature, queue: [...value.queue] }]));
    return selected;
  };
}

export const nextPopularStationBatch = createPopularStationRotation();

/** Unknown country placeholders are not eligible for Home recommendations. */
export function hasPopularStationCountry(station: { country?: string | null }): boolean {
  const country = station.country?.trim().toLowerCase();
  return !!country && !['unknown', 'n/a', 'null', 'undefined', '-', 'global', 'all'].includes(country);
}

// Country names from this API are canonical; normalize aliases that also occur in imports.
export function popularCountryKey(station: { country?: string | null }): string {
  if (!hasPopularStationCountry(station)) return '';
  const name = station.country!.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^the /, '');
  if (['turkey', 'türkiye', 'turkiye'].includes(name)) return 'turkey';
  if (['usa', 'us', 'united states', 'united states of america'].includes(name)) return 'united states';
  if (['uk', 'gb', 'united kingdom', 'united kingdom of great britain and northern ireland'].includes(name)) return 'united kingdom';
  const aliases: Record<string, string> = {
    'islamic republic of iran': 'iran', 'iran, islamic republic of': 'iran',
    'russian federation': 'russia', 'czech republic': 'czechia',
    'korea, republic of': 'south korea', 'republic of korea': 'south korea',
    'korea, democratic people’s republic of': 'north korea',
    'democratic people’s republic of korea': 'north korea',
    'viet nam': 'vietnam', 'republic of moldova': 'moldova',
    'united republic of tanzania': 'tanzania',
  };
  return aliases[name] || name;
}

/** Round-robin country buckets while preserving API popularity order within each country. */
export function buildGlobalPopularPool<T extends { _id: string; country?: string | null }>(stations: readonly T[], limit = 20): T[] {
  const buckets = new Map<string, T[]>();
  const seen = new Set<string>();
  for (const station of stations) {
    const key = popularCountryKey(station);
    if (!key || !station._id || seen.has(station._id)) continue;
    seen.add(station._id);
    const bucket = buckets.get(key) || [];
    bucket.push(station);
    buckets.set(key, bucket);
  }
  const result: T[] = [];
  for (let index = 0; result.length < limit; index++) {
    let added = false;
    for (const bucket of buckets.values()) {
      if (!bucket[index]) continue;
      result.push(bucket[index]);
      added = true;
      if (result.length === limit) break;
    }
    if (!added) break;
  }
  return result;
}
