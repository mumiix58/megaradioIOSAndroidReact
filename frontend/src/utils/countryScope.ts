/** Canonical global scope is persisted as Global; the API expects no country filter. */
export const isGlobalCountry = (value?: string | null) => typeof value === 'string' && ['global', 'all'].includes(value.trim().toLowerCase());
