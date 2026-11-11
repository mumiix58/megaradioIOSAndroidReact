type IdentifiedStation = { _id?: string; id?: string };

/** Advance a radio queue without selecting the currently playing station again. */
export function nextRecommendation<T extends IdentifiedStation>(
  stations: T[],
  currentId: string | null | undefined,
  savedIndex: number,
): { station: T; index: number } | null {
  if (!stations.length) return null;
  const start = Number.isInteger(savedIndex) && savedIndex >= -1 && savedIndex < stations.length
    ? savedIndex : -1;
  for (let offset = 1; offset <= stations.length; offset++) {
    const index = (start + offset) % stations.length;
    const station = stations[index];
    const id = station?._id || station?.id;
    if (id && id !== currentId) return { station, index };
  }
  return null;
}
