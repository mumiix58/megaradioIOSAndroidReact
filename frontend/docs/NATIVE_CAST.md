# Native device casting

## Mobile flow

The player keeps the existing `mirroring-screen.svg` icon. A transparent native Google Cast button occupies its44×44 hit area, so tapping opens the SDK device picker directly, including its first-use permission flow. There is no MegaRadio cast modal, fake device list, Wi-Fi instructions, or account-pairing step. iOS AirPlay opens the native audio route picker directly (three-dot menu; also the primary fallback when Google Cast is absent).

`NativeCastProvider` lives inside AudioProvider across routes. `useCastTransfer` waits for an explicit sender gesture/new native session, resolves legacy playlists, builds LIVE audio media, and loads each session/station/stream once. Track metadata updates do not restart audio. A successful receiver load pauses the phone; rejection preserves local audio. Stale completions cannot pause a newly selected station. Native media status and player/mini-player transport controls target the receiver while casting. Native picker owns device disconnection; stop uses `getSessionManager().endCurrentSession(true)`.

The browser preview does not have the native SDK or LAN device discovery. Its existing icon shows a short inline notice, never a placeholder device-selection modal. Regular mobile audio and startup preferences remain separate.

## Verification

Run from frontend: `node scripts/tests/native-cast.test.cjs` (26 SDK, transport, and first-render regression cases). Browser checks cover repeated taps, no modal insertion, notice expiry, and lock-disabled controls. TypeScript has existing unrelated project errors; changed casting modules have no reported errors.

These checks are not a physical receiver test. Native iOS/Android builds and an actual Cast/AirPlay device are required to verify LAN discovery, receiver access to a particular station URL and codec, permissions, and playback over the home network. Only Cast/AirPlay-compatible receivers appear; any powered-on TV is not automatically compatible.

## TV phase (explicitly deferred)

Current generated mobile iOS configuration uses the Default Media Receiver (`CC1AD845`); Android uses the package's default provider. The unenabled legacy plugin mentions `94952E1F`; its registry/ownership has not been verified and it has not been activated. The TV Android project currently has no Cast Connect receiver dependency or `com.google.android.gms.cast.tv.action.LAUNCH` intent. No TV app/receiver registration or deployment was changed in this task.

To open the installed MegaRadio Android TV app instead of the Web Receiver, the later TV phase must implement Cast Connect and associate the native receiver/package with a verified Cast application ID and Web Receiver fallback. Merely installing the TV app or using the same account does not provide that launch integration.

Sources checked: installed react-native-google-cast4.9.1 APIs; https://react-native-google-cast.github.io/docs/api/classes/castcontext ; https://developers.google.com/cast/docs/android_tv_receiver/core_features ; https://developers.google.com/cast/docs/web_receiver .

## Design reference search

Figma `Jf3ZOklsARouzh5Mop0rRz`, all pages: Cast, mirroring, AirPlay, device and connect were searched on2026-11-09. No dedicated device picker design was identified. The final choice is the actual platform/Google SDK picker, as requested, rather than a custom approximation of platform UI.
