import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPopularStationRotation, type PopularRotationSnapshot } from '../utils/popularStationRotation';

const KEY = 'home-popular-rotation:v1';
let next = createPopularStationRotation();
let write = Promise.resolve();
// One small local read per app launch. A storage failure never blocks Home.
export const homePopularRotationReady = AsyncStorage.getItem(KEY).then(raw => {
  let initial: PopularRotationSnapshot = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) initial = parsed.filter(entry =>
      Array.isArray(entry) && typeof entry[0] === 'string' &&
      typeof entry[1]?.signature === 'string' && Array.isArray(entry[1]?.queue) &&
      entry[1].queue.length <= 20 && entry[1].queue.every((id: unknown) => typeof id === 'string'),
    );
  } catch { /* Invalid persisted data starts a fresh deck. */ }
  next = createPopularStationRotation(32, initial, snapshot => {
    const value = JSON.stringify(snapshot);
    write = write.then(() => AsyncStorage.setItem(KEY, value)).catch(() => {});
  });
}).catch(() => {});

export const nextHomePopularBatch = (scope: string, ids: readonly string[], countries?: ReadonlyMap<string, string>) => next(scope, ids, 4, countries);
