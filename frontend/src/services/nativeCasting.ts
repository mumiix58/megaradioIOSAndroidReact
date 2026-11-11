import { NativeModules, Platform } from 'react-native';

export let GoogleCast: any = null;
export let CastButton: any = null;
export let AirplayButton: any = null;
let routePicker: any = null;
if (Platform.OS !== 'web' && NativeModules.RNGCCastContext) {
  try { const mod = require('react-native-google-cast'); GoogleCast = mod.default; CastButton = mod.CastButton; } catch { /* No native Cast SDK in this build. */ }
}
if (Platform.OS === 'ios' && NativeModules.RAAirplayConnectivityContext) {
  try { const mod = require('react-airplay'); AirplayButton = mod.AirplayButton; routePicker = mod.showRoutePicker; } catch { /* No native AirPlay SDK in this build. */ }
}
export const isAirplayAvailable = !!AirplayButton && !!routePicker;
export async function showAirplayPicker() { await routePicker?.({ prioritizesVideoDevices: false }); }
