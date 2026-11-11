/** Pin the original dot field along its left and bottom attachment edges. */
export function splashClothWeight(x: number, y: number): number {
  'worklet';
  const left = 1 - Math.exp(-Math.max(0, x - 10) / 55);
  const bottom = 1 - Math.exp(-Math.max(0, 671 - y) / 60);
  return left * bottom;
}

/** One broad travelling fold; no rigid translation, rotation or repeated small ripples. */
export function splashClothOffset(weight: number, localPhase: number, phase: number, amount: number): [number, number] {
  'worklet';
  const fold = localPhase - phase;
  return [3.2 * weight * amount * Math.sin(fold + 0.45), 9 * weight * amount * Math.sin(fold)];
}
