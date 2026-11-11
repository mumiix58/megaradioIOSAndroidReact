/** Compatibility bridge for existing engagement calls. Playback/screen events live in AnalyticsObserver. */
import analyticsService from './analyticsService';
import type { User } from '../types';

export const ANALYTICS_EVENTS = {
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  USER_SIGNED_UP: 'user_signed_up',
  STATION_PLAYED: 'station_played',
  STATION_PAUSED: 'station_paused',
  STATION_STOPPED: 'station_stopped',
  PLAYBACK_ERROR: 'playback_error',
  STATION_FAVORITED: 'station_favorited',
  STATION_UNFAVORITED: 'station_unfavorited',
  SCREEN_VIEWED: 'screen_viewed',
  SEARCH_PERFORMED: 'search_performed',
  GENRE_SELECTED: 'genre_selected',
  NOTIFICATION_OPENED: 'notification_opened',
  SHARE_CLICKED: 'share_clicked',
  CARPLAY_CONNECTED: 'carplay_connected',
  ANDROID_AUTO_CONNECTED: 'android_auto_connected',
  AD_VIEWED: 'ad_viewed',
  AD_CLICKED: 'ad_clicked',
  AD_REWARDED: 'ad_rewarded',
} as const;

class FlowaliveServiceBridge {
  async initDevice(): Promise<void> {
    // Kept for API compatibility; the central observer owns lifecycle and identity.
  }

  async setUser(_user: User): Promise<void> {
    // Kept for API compatibility; the central observer owns lifecycle and identity.
  }

  async clearUser(): Promise<void> {
    // Kept for API compatibility; the central observer owns lifecycle and identity.
  }

  track(_event: string, _params?: Record<string, unknown>): void {
    // Kept for API compatibility; the central observer owns lifecycle and identity.
  }

  trackStationPlayed(_stationId: string, _stationName: string, _genre?: string): void {}
  trackStationPaused(_stationId: string, _stationName: string): void {}
  trackStationFavorited(id: string, name: string): void { void analyticsService.logStationFavorite(id,name,true); }
  trackStationUnfavorited(id: string, name: string): void { void analyticsService.logStationFavorite(id,name,false); }
  trackSearch(query: string, count: number): void { void analyticsService.logSearch(query,count); }
  trackGenreSelected(_id: string, name: string): void { void analyticsService.logGenreBrowse(name); }
  trackAdViewed(type: string): void { void analyticsService.logAdWatched(type); }
  trackAdRewarded(_rewardType: string, _rewardAmount: number): void {}
  trackPlaybackError(_stationId: string, _errorMessage: string): void {}
  trackUserLogin(method: string): void { void analyticsService.logLogin(method); }
  trackUserSignup(method: string): void { void analyticsService.logSignUp(method); }
  trackUserLogout(): void { void analyticsService.logEvent('logout'); }
  trackNotificationOpened(type: string): void { void analyticsService.logEvent('notification_open',{notification_type:type}); }
}

export const flowaliveService = new FlowaliveServiceBridge();
export default flowaliveService;
