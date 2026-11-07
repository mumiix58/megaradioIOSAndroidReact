export interface TvConsent { diagnostics: boolean; analytics: boolean }
const reporter = () => typeof window === 'undefined' ? undefined : (window as any).MRTVTelemetry;
export function tvObservabilitySupported(): boolean { try { return reporter()?.supported() === true; } catch (_) { return false; } }
export function getTvConsent(): TvConsent { return reporter()?.getConsent() || { diagnostics: false, analytics: false }; }
export function setTvConsent(value: TvConsent): TvConsent {
  try { return reporter()?.setConsent(value) || {diagnostics:false,analytics:false}; } catch (_) { return {diagnostics:false,analytics:false}; }
}
export function reportTvEvent(event: string, code = 'none', context?: {route?: string; module?: string; line?: number; column?: number}) {
  try { reporter()?.emit(event, code, context); } catch (_) { /* Reporting never affects listening. */ }
}
export function tvErrorCode(error: unknown): string {
  const value = error as {name?: string; code?: number; message?: string} | null;
  if (typeof value?.message === 'string' && /^Request timeout after \d+ms$/.test(value.message)) return 'request_timeout';
  if (value?.name === 'AbortError') return 'request_timeout';
  if (value?.name === 'TypeError') return 'network_error';
  return 'http_error';
}
