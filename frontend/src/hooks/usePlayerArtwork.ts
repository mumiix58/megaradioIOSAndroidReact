import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import type { Station } from '../types';
import { playerOriginalCandidate, isSharperPlayerOriginal } from '../utils/playerArtwork';

const checked = new Map<string, Promise<string | null>>();
function inspectOriginal(url: string): Promise<string | null> {
  const cached = checked.get(url);
  if (cached) return cached;
  const check = new Promise<string | null>(resolve => {
    const timer = setTimeout(() => resolve(null), 4000);
    Image.getSize(url, (width, height) => {
      clearTimeout(timer);
      resolve(isSharperPlayerOriginal(url, width, height) ? url : null);
    }, () => { clearTimeout(timer); resolve(null); });
  }).catch(() => null);
  if (checked.size >= 64) checked.delete(checked.keys().next().value!);
  checked.set(url, check);
  return check;
}

/** The working artwork paints immediately; one cached background check may improve it. */
export function usePlayerArtwork(station: Station | null | undefined, fallback: string | null): string | null {
  const candidate = playerOriginalCandidate(station, fallback);
  const [upgrade, setUpgrade] = useState<{ candidate: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (candidate) void inspectOriginal(candidate).then(url => {
      if (active && url) setUpgrade({ candidate, url });
    });
    return () => { active = false; };
  }, [candidate]);
  return candidate && upgrade?.candidate === candidate ? upgrade.url : fallback;
}
