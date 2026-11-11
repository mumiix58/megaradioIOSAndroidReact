/** Most common chromatic pixel cluster; neutral logo backgrounds must not glow. */
export function dominantLogoColor(pixels: ArrayLike<number>): string | null {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  let samples = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 192) continue;
    samples++;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const high = Math.max(r, g, b), low = Math.min(r, g, b);
    if (high < 45 || high - low < 28 || (high - low) / high < 0.2) continue;
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
  }
  const winner = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!winner || winner.count < Math.max(2, samples * 0.015)) return null;
  return '#' + [winner.r, winner.g, winner.b].map(value => Math.round(value / winner.count).toString(16).padStart(2, '0')).join('');
}
