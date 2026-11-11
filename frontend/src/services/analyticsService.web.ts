// Web/Node stub for Firebase Analytics - no-op implementation
// Firebase Analytics only works on native (iOS/Android)

class AnalyticsService {
  async logEvent(_name:string,_params:Record<string,string|number>={}):Promise<void>{}
  async initialize(): Promise<void> {}
  async logScreenView(_screenName: string, _screenClass?: string): Promise<void> {}
  async logAppOpen(): Promise<void> {}
  async logAppLaunch(_launchSource: string): Promise<void> {}
  async logStartupTime(_durationMs: number): Promise<void> {}
  async logDiagnosticEvent(_name: string, _parameters: Record<string, string | number>): Promise<void> {}
  async logStationPlay(_stationId: string, _stationName: string, _genre?: string): Promise<void> {}
  async logStationFavorite(_stationId: string, _stationName: string, _isFavorite: boolean): Promise<void> {}
  async logPremiumPurchase(_productId: string, _price?: string): Promise<void> {}
  async logPaywallView(_source: string): Promise<void> {}
  async logAdWatched(_adType: string, _stationId?: string): Promise<void> {}
  async logSearch(_searchTerm: string, _resultsCount: number): Promise<void> {}
  async logGenreBrowse(_genreName: string): Promise<void> {}
  async logCarConnect(_platform: 'carplay' | 'android_auto'): Promise<void> {}
  async logLogin(_method: string): Promise<void> {}
  async logSignUp(_method: string): Promise<void> {}
  async setUserId(_userId: string | null): Promise<void> {}
  async setUserProperty(_name: string, _value: string): Promise<void> {}
  async setIsPremium(_isPremium: boolean): Promise<void> {}
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
