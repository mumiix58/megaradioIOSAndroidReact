/** w40 flags are undersized once a 2:1 flag fills a 40px circle at 3× density.
 * A 320px source covers even the short edge without loading the entire catalog. */
export function countryFlagUrl(code?:string|null):string|null {
  const iso=code?.trim().toLowerCase();
  return iso&&/^[a-z]{2}$/.test(iso)?`https://flagcdn.com/w320/${iso}.png`:null;
}
export function countryFlagEmoji(code?:string|null){
  const iso=code?.trim().toUpperCase();
  return iso&&/^[A-Z]{2}$/.test(iso)?String.fromCodePoint(...[...iso].map(c=>c.charCodeAt(0)+127397)):'🌐';
}
