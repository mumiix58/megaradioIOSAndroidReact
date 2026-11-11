/** Shared display/search labels. Canonical API country names and ISO codes never change. */
const names = require('../data/countryNames.json') as Record<string, Record<string, string>>;
export const COUNTRY_LABEL_LANGUAGES = Object.keys(names);
type CountryIdentity = { code: string; name: string; nativeName?: string };
const codeOf = (country: CountryIdentity) => (country.code || '').trim().toUpperCase();
export function countrySearchKey(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/ł/g, 'l')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
export function localizedCountryName(country: CountryIdentity, language: string): string {
  const locale = (language || 'en').toLowerCase().split(/[-_]/)[0];
  return names[locale]?.[codeOf(country)] || country.name || country.nativeName || country.code;
}
const aliases: Record<string,string[]> = {
  TR:['Turkey','Türkiye','Turkiye'], GB:['UK','Britain','Great Britain','İngiltere','Birleşik Krallık'],
  US:['USA','United States','United States of America','ABD','Amerika Birleşik Devletleri'],
  NL:['Hollanda','Holland'], CZ:['Czech Republic','Czechia'], KR:['South Korea','Güney Kore'],
};
const codeKeys = new Map<string,string[]>();
export function countrySearchTerms(country: CountryIdentity): string[] {
  const code = codeOf(country);
  let keys = codeKeys.get(code);
  if (!keys) {
    keys = [...new Set([...Object.values(names).map(locale => locale[code]), ...(aliases[code] || [])]
      .filter((name): name is string => !!name).map(countrySearchKey))];
    codeKeys.set(code, keys);
  }
  return [...keys, country.name, country.nativeName || '', code].map(countrySearchKey).filter(Boolean);
}
/** One ISO identity per row; duplicate API entries must never reuse FlatList keys. */
export function uniqueCountries<T extends CountryIdentity>(countries: T[]): T[] {
  const unique = new Map<string,T>();
  for (const country of countries) {
    const key = codeOf(country) || countrySearchKey(country.name);
    if (!unique.has(key)) unique.set(key, country);
  }
  return [...unique.values()];
}
export function filterCountries<T extends CountryIdentity>(countries: T[], search: string): T[] {
  const query = countrySearchKey(search);
  if (!query) return countries;
  const exactCode = query.length === 2 ? countries.find(country => codeOf(country).toLowerCase() === query) : undefined;
  if (exactCode) return [exactCode];
  return countries.map((country,index) => {
    const terms = countrySearchTerms(country);
    const rank = terms.some(term => term === query) ? 0
      : terms.some(term => term.startsWith(query)) ? 1
      : terms.some(term => term.includes(query)) ? 2 : 3;
    return {country,index,rank};
  }).filter(match => match.rank < 3)
    .sort((a,b) => a.rank-b.rank || a.index-b.index).map(match => match.country);
}
