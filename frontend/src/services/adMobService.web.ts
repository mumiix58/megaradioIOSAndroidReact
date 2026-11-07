// adMobService.web.ts
// Web stub for AdMob (not supported on web)

class AdMobServiceWeb {
  async initialize(): Promise<boolean> {
    console.log('[AdMob] Not available on web');
    return false;
  }

  async loadInterstitialAd(): Promise<void> {}
  async loadRewardedAd(): Promise<void> {}
  async loadAppOpenAd(): Promise<void> {}
  async showAppOpenAd(): Promise<boolean> { return false; }
  
  async isAdFree(): Promise<boolean> {
    return true; // Always ad-free on web
  }

  async getAdFreeMinutesRemaining(): Promise<number> {
    return 9999; // Always ad-free on web
  }

  async grantAdFreeTime(_minutes: number = 30): Promise<void> {}
  
  async waitForPresentation(): Promise<void> {}

  async onStationChange(): Promise<boolean> {
    return false;
  }

  async showInterstitialAd(): Promise<boolean> {
    return false;
  }

  async showRewardedAd(): Promise<{ success: boolean; reward?: { type: string; amount: number } }> {
    return { success: false };
  }

  isRewardedAdReady(): boolean {
    return false;
  }

  shouldShowFirstStationAd(): boolean {
    return false;
  }

  markFirstStationAdShown(): void {}

  isInterstitialAdReady(): boolean {
    return false;
  }
}

export const adMobService = new AdMobServiceWeb();
export default adMobService;
