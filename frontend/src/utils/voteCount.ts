/** Stable K/M suffix across locales; full exact total remains in accessibility text. */
export function formatVoteCount(count: number, locale = 'en'): string {
  const unit = count >= 999950 ? 1e6 : count >= 1000 ? 1000 : 1;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 1 ? 0 : 1 }).format(count / unit) + (unit === 1e6 ? 'M' : unit === 1000 ? 'K' : '');
}
