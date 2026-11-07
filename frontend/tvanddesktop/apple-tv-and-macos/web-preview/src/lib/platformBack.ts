/** Delegate LG entry Back to its platform (Home on old TVs, native exit UI on new TVs). */
export function handleEntryBack(platform: string, host: any, confirmExit: () => void): void {
  if (platform === 'webos') {
    try {
      if (typeof host.webOS?.platformBack === 'function') {
        host.webOS.platformBack();
        return;
      }
      // Same legacy native bridge used by the bundled official webOSTV.js SDK.
      if (typeof host.PalmSystem?.platformBack === 'function') {
        host.PalmSystem.platformBack();
        return;
      }
    } catch { /* Keep an operable exit path if an unavailable bridge throws. */ }
  }
  confirmExit();
}
