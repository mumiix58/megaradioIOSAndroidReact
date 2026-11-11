export function sleepPickerIndex(offset: number, itemHeight: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(offset / itemHeight)));
}
export function formatSleepTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  return [Math.floor(total / 3600), Math.floor(total % 3600 / 60), total % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
