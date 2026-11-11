import type { Station } from '../types';

/** Only inspect the archived original beside the already selected, managed logo. */
export function playerOriginalCandidate(station: Station | null | undefined, fallback: string | null): string | null {
  const assets = station?.logoAssets;
  if (assets?.status !== 'completed' || !assets.original || !fallback) return null;
  try {
    const base = new URL(fallback);
    const original = new URL(assets.original, base);
    const directory = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
    if (base.protocol !== 'https:' || original.origin !== base.origin ||
        original.username || original.password || original.search || original.hash ||
        directory(original.pathname) !== directory(base.pathname) ||
        !/\/original\.(?:png|jpe?g|webp|svg)$/i.test(original.pathname)) return null;
    return original.href;
  } catch { return null; }
}

export function isSharperPlayerOriginal(url: string, width: number, height: number): boolean {
  // Avoid changing the existing crop/composition or enlarging a small favicon.
  return Number.isFinite(width) && Number.isFinite(height) && width === height &&
    width > 0 && (/\.svg$/i.test(url) || width >= 512);
}
