export const CAROUSEL_STEP = 75;
export function carouselIndex(position: number, count: number) {
  'worklet';
  return count > 0 ? ((Math.round(position) % count) + count) % count : 0;
}
export function carouselDelta(slot: number, position: number, count: number) {
  'worklet';
  return count > 0 ? ((slot - position + count / 2) % count + count) % count - count / 2 : 0;
}
export function carouselLanding(position: number, velocity: number, unit: number, reduceMotion = false) {
  'worklet';
  const speed = Math.max(-3.5, Math.min(3.5, velocity));
  const coast = reduceMotion ? 0 : Math.abs(speed) < 0.12 ? 0 : Math.max(-10, Math.min(10, -speed * 210 / (CAROUSEL_STEP * Math.max(unit, 0.1))));
  const target = Math.round(position + coast);
  return { target, duration: reduceMotion ? 0 : Math.min(1150, 260 + Math.sqrt(Math.abs(target - position)) * 170) };
}
export const CAROUSEL_CENTERS = [-50, 63, 113, 188, 263, 312, 425];
export const CAROUSEL_SIZES = [66, 96, 126, 150, 126, 96, 66];
export const CAROUSEL_RADII = [12, 12, 12, 14.62, 12, 12, 12];
function smoothSample(values: number[], offset: number) {
  'worklet';
  const x = Math.max(0, Math.min(6, offset + 3));
  const i = Math.min(5, Math.floor(x)), t = x - i;
  const a = values[Math.max(0, i - 1)], b = values[i], c = values[i + 1], d = values[Math.min(6, i + 2)];
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}
/** Shared by rendering and hit testing: integer depth, stable ring items, smooth scale. */
export function carouselGeometry(offset: number) {
  'worklet';
  const distance = Math.abs(offset);
  const fade = Math.max(0, Math.min(1, 3 - distance));
  return {
    center: smoothSample(CAROUSEL_CENTERS, offset),
    size: smoothSample(CAROUSEL_SIZES, offset),
    radius: smoothSample(CAROUSEL_RADII, offset),
    depth: Math.max(0, Math.round(1000 - distance * 100)),
    opacity: distance <= 2 ? 1 : fade * fade * (3 - 2 * fade),
  };
}
export function carouselTapTarget(x: number, y: number, position: number, physicalCount: number) {
  'worklet';
  let bestDistance = Infinity, target: number | null = null;
  for (let slot = 0; slot < physicalCount; slot++) {
    const offset = carouselDelta(slot, position, physicalCount);
    if (Math.abs(offset) >= 3) continue;
    const card = carouselGeometry(offset), half = card.size / 2;
    if (x < card.center - half || x > card.center + half || y < 75 - half || y > 75 + half) continue;
    if (Math.abs(offset) < bestDistance) { bestDistance = Math.abs(offset); target = Math.round(position + offset); }
  }
  return target;
}
