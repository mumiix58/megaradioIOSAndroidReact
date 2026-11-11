/** Ratchet only after a deliberate long pull; ordinary pulls retain the approved spring feel. */
export function worldDialNotch(translation: number, unit: number) {
  'worklet';
  const travel = Math.abs(translation) / Math.max(0.1, unit);
  return Math.sign(translation) * Math.min(4, Math.floor(Math.max(0, travel - 90) / 55));
}
export function worldDialPhase(notch: number) {
  'worklet';
  return -notch * 0.65;
}
