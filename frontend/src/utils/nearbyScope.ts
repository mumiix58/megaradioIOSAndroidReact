import { isGlobalCountry } from './countryScope';

/** Country-only discovery must never invent coordinates or distances. */
export function nearbyScope(lat: number | null, lng: number | null, country?: string | null) {
  const hasCoordinates = typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
  const scopeCountry = country && !isGlobalCountry(country) ? country : undefined;
  return {
    enabled: hasCoordinates || !!scopeCountry,
    params: hasCoordinates ? { lat: lat!, lng: lng!, userCountry: scopeCountry } : { country: scopeCountry },
  };
}

/** Permission CTA ends at authorization, even if a desktop cannot resolve GPS. */
export function shouldShowNearbyLocationPrompt(permission: string, lat: number | null, lng: number | null, preview = false) {
  const hasCoordinates = typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
  return !preview && permission !== 'granted' && !hasCoordinates;
}
