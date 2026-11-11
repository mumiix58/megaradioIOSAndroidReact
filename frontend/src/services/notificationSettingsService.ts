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
  async enabled():Promise<boolean>{const scope=captureAccount();if(!scope.token||!scope.ownerId)return false;const {getPushPreference}=await import('./notificationPreferences');return await getPushPreference(scope.ownerId)&&isAccountCurrent(scope);},
  async setEnabled(enabled:boolean):Promise<void>{const scope=captureAccount();if(!scope.token||!scope.ownerId)throw new Error('Sign in to change notification preferences.');const {savePushPreference}=await import('./notificationPreferences');await savePushPreference(scope.ownerId,enabled);if(!isAccountCurrent(scope))throw new Error('Account changed');},

};
