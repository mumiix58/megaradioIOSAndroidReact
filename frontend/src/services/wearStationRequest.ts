type WearStationRequest = { type?: string; requestId?: string; genreId?: string; countryCode?: string };

/** Replies carry the selection ID so late/cached catalog data cannot replace it. */
export async function handleWearStationRequest(
  request: WearStationRequest,
  loadGenre: (genre: string) => Promise<any[]>,
  loadCountry: (country: string) => Promise<any[]>,
  reply: (id: string, stations: any[], error: string) => void,
): Promise<boolean> {
  if (!request.requestId || request.requestId.length > 100) return false;
  const load = request.type === 'genre_stations' && request.genreId
    ? () => loadGenre(request.genreId!)
    : request.type === 'country_stations' && request.countryCode
      ? () => loadCountry(request.countryCode!) : null;
  if (!load) return false;
  try { reply(request.requestId, await load(), ''); }
  catch { reply(request.requestId, [], 'catalog_unavailable'); }
  return true;
}
