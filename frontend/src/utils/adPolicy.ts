// Full-screen advertising is tied to an explicit station change, never a timer.
export const AD_POLICY = {
  stationChanges: 5,
  minimumIntervalMs: 10 * 60 * 1000,
  maximumAutomaticAdsPerSession: 3,
  rewardedMinutes: 30,
} as const;

let automaticPolicy = { enabled: true, stationChanges: 5, minimumIntervalMs: 600000, maximumAutomaticAdsPerSession: 3 };

// Server changes may reduce ad pressure, never exceed the shipped safeguards.
export function updateAutomaticAdPolicy(values: Partial<typeof automaticPolicy>): void {
  const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
  automaticPolicy = {
    enabled: typeof values.enabled === 'boolean' ? values.enabled : automaticPolicy.enabled,
    stationChanges: bounded(values.stationChanges, 5, 5, 100),
    minimumIntervalMs: bounded(values.minimumIntervalMs, 600000, 600000, 86400000),
    maximumAutomaticAdsPerSession: bounded(values.maximumAutomaticAdsPerSession, 3, 0, 3),
  };
}

export function canShowStationAd(input: {
  now: number; sessionStartedAt: number; lastFullScreenAt: number;
  stationChanges: number; automaticAdsThisSession: number;
  foreground: boolean; adFree: boolean; showing: boolean;
}): boolean {
  return automaticPolicy.enabled && input.foreground && !input.adFree && !input.showing &&
    input.stationChanges >= automaticPolicy.stationChanges &&
    input.automaticAdsThisSession < automaticPolicy.maximumAutomaticAdsPerSession &&
    input.now - Math.max(input.sessionStartedAt, input.lastFullScreenAt) >= automaticPolicy.minimumIntervalMs;
}
