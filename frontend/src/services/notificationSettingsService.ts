import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { captureAccount, isAccountCurrent, accountKey } from '../store/accountScope';
export type NotificationSettings = { favorites: boolean; nowPlaying: boolean; newStations: boolean; recommendations: boolean };
const defaults: NotificationSettings = { favorites: true, nowPlaying: true, newStations: false, recommendations: false };
export const notificationSettingsService = {
  async get(): Promise<NotificationSettings> {
    const response = await api.get('/api/user/notification-settings');
    const settings = response.data?.notificationSettings;
    if (!settings || Object.keys(defaults).some(key => typeof settings[key] !== 'boolean')) throw new Error('Invalid notification preferences');
    return settings;
  },
  async enabled(): Promise<boolean> {
    const scope = captureAccount();
    if (!scope.token) return false;
    const settings = await this.get();
    return isAccountCurrent(scope) && Object.values(settings).some(Boolean);
  },
  async setEnabled(enabled: boolean): Promise<void> {
    const scope = captureAccount();
    if (!scope.token) throw new Error('Sign in to change notification preferences.');
    const current = await this.get();
    if (!isAccountCurrent(scope)) throw new Error('Account changed');
    const key = accountKey('notification_preferences', scope);
    let settings = current;
    if (!enabled) {
      if (Object.values(current).some(Boolean)) await AsyncStorage.setItem(key, JSON.stringify(current));
      settings = { favorites: false, nowPlaying: false, newStations: false, recommendations: false };
    } else if (!Object.values(current).some(Boolean)) {
      const previous = await AsyncStorage.getItem(key);
      settings = previous ? JSON.parse(previous) : defaults;
    }
    if (!isAccountCurrent(scope)) throw new Error('Account changed');
    await api.patch('/api/user/notification-settings', settings);
  },
};
