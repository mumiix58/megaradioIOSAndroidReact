import { reportTvEvent } from './tvObservability';

// TV usage counters are first-party and opt-in. No Google loader, cookies,
// raw search text or station names leave this adapter. The reporter separately
// manages a random usage ID only while the user explicitly enables analytics.
export const initGA = () => {};
export const trackPageView = (route: string) => reportTvEvent('screen_view', 'none', {route, module:'main'});
// Playback is recorded at the real player onPlay/onPause callbacks, not selection.
export const trackStationPlay = (_name: string, _country: string, _genre?: string) => {};
export const trackFavoriteToggle = (_name: string, _added: boolean) => {};
export const trackCountryChange = (_country: string) => {};
export const trackSearch = (_query: string, _count: number) => {};
export const trackError = (_message: string, _context?: string) => {};
export const trackEvent = (_action: string, _category?: string, _label?: string, _value?: number) => {};
