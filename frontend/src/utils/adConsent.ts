type ConsentInfo = { canRequestAds: boolean };
type ConsentAPI = {
  requestInfoUpdate: () => Promise<ConsentInfo>;
  loadAndShowConsentFormIfRequired: () => Promise<ConsentInfo>;
  getConsentInfo: () => Promise<ConsentInfo>;
};

// No SDK initialization when the OS permission request is missing/unresolved,
// or when UMP says ads cannot be requested. Denied ATT keeps existing NPA ads.
export async function prepareAdConsent(
  platform: string,
  requestTracking: (() => Promise<string>) | undefined,
  consent: ConsentAPI,
): Promise<boolean> {
  if (platform === 'ios') {
    if (!requestTracking) return false;
    try {
      const status = await requestTracking();
      if (!['authorized', 'denied', 'restricted'].includes(status)) return false;
    } catch {
      return false;
    }
  }
  try {
    await consent.requestInfoUpdate();
    return (await consent.loadAndShowConsentFormIfRequired()).canRequestAds === true;
  } catch {
    // A network error may still leave a valid prior consent decision.
    try { return (await consent.getConsentInfo()).canRequestAds === true; }
    catch { return false; }
  }
}
