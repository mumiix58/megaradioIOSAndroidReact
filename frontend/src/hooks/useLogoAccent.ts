import { useEffect, useState } from 'react';
import { readLogoAccent } from '../services/logoAccent';

const cache = new Map<string, Promise<string | null>>();
export function useLogoAccent(uri: string | null) {
  const [result, setResult] = useState<{ uri: string; color: string | null } | null>(null);
  useEffect(() => {
    setResult(null);
    if (!uri) return;
    let active = true;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      let pending = cache.get(uri);
      if (!pending) {
        pending = readLogoAccent(uri);
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(uri, pending);
      }
      void pending.then(color => { if (active) setResult({ uri, color }); }, () => {
        cache.delete(uri);
        if (active && retries++ === 0) retryTimer = setTimeout(load, 1500);
      });
    };
    load();
    return () => { active = false; clearTimeout(retryTimer); };
  }, [uri]);
  return result?.uri === uri ? result.color : null;
}
