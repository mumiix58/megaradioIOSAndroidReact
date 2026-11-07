import { AppState } from 'react-native';
import { updateAutomaticAdPolicy } from '../utils/adPolicy';

const defaults = {
  radio_auto_ads_enabled: true,
  radio_ad_min_interval_seconds: 600,
  radio_ad_station_changes: 5,
  radio_ad_session_cap: 3,
};

let initialization: Promise<void> | undefined;
// Non-blocking: safe local defaults work offline and no consent/purchase rule is remote-controlled.
export function initializeFirebaseRuntime(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      const remoteConfig = require('@react-native-firebase/remote-config').default;
      const config = remoteConfig();
      await config.setDefaults(defaults);
      await config.setConfigSettings({ minimumFetchIntervalMillis: 3600000, fetchTimeMillis: 8000 });
      const apply = () => updateAutomaticAdPolicy({
        enabled: config.getBoolean('radio_auto_ads_enabled'),
        minimumIntervalMs: config.getNumber('radio_ad_min_interval_seconds') * 1000,
        stationChanges: config.getNumber('radio_ad_station_changes'),
        maximumAutomaticAdsPerSession: config.getNumber('radio_ad_session_cap'),
      });
      await config.activate();
      apply();
      // Background fetch does not hold app launch or radio playback.
      void config.fetchAndActivate().then(apply).catch(() => {});
      AppState.addEventListener('change', state => {
        if (state === 'active') void config.fetchAndActivate().then(apply).catch(() => {});
      });
    } catch { /* Old native binaries and offline devices retain local defaults. */ }
    try {
      const perf = require('@react-native-firebase/perf').default;
      await perf().setPerformanceCollectionEnabled(!__DEV__);
    } catch { /* Observability never blocks listening. */ }
  })();
  return initialization;
}

// Custom API traces use a fixed name, method and status only: never URLs, tokens or account data.
export async function startApiPerformanceTrace(method: string): Promise<any | null> {
  try {
    const perf = require('@react-native-firebase/perf').default;
    const trace = await perf().startTrace('radio_api_request');
    trace.putAttribute('method', /^(GET|POST|PATCH|PUT|DELETE)$/.test(method) ? method : 'OTHER');
    return trace;
  } catch { return null; }
}
