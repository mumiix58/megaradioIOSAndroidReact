import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api from './api';
import { API_ENDPOINTS } from '../constants/api';

import {readCachedPushPreference,savePushPreference} from './notificationPreferences';
const PUSH_TOKEN_KEY = '@megaradio_push_token';
const currentOwner=()=>{const auth=require('../store/authStore').useAuthStore.getState();return auth.isAuthenticated?(auth.user?._id||auth.user?.id):undefined;};

// Only configure notification handler on native platforms
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const owner=currentOwner();
      const enabled=!!owner&&(await readCachedPushPreference(owner))===true;
      return { shouldShowAlert: enabled, shouldShowBanner: enabled, shouldShowList: enabled, shouldPlaySound: enabled, shouldSetBadge: enabled };
    },
  });
}

export interface PushNotificationService {
  registerForPushNotifications: (options?:{requestPermission?:boolean}) => Promise<string | null>;
  sendPushTokenToBackend: (token: string) => Promise<void>;
  deletePushTokenFromBackend: (token: string) => Promise<void>;
  getStoredPushToken: () => Promise<string | null>;
  addNotificationListener: (callback: (notification: Notifications.Notification) => void) => () => void;
  addNotificationResponseListener: (callback: (response: Notifications.NotificationResponse) => void) => () => void;
  handleNotificationNavigation: (data: any) => void;
  isNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const pushNotificationService: PushNotificationService = {
  /**
   * Register for push notifications and get the Expo Push Token
   * Call this AFTER user logs in
   */
  async registerForPushNotifications({requestPermission=false}={}): Promise<string | null> {
    let token: string | null = null;

    // Check if it's a real device (notifications don't work on simulators)
    if (!Device.isDevice) {
      console.log('[PushNotification] Must use physical device for Push Notifications');
      return null;
    }

    // Android 13 requires a channel before requesting notification permission.
    if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{name:'Default',importance:Notifications.AndroidImportance.MAX,vibrationPattern:[0,250,250,250],lightColor:'#FF4199'});

    // Silent on login; only an explicit enable action can request permission.
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted'&&requestPermission) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushNotification] Permission not granted');
      return null;
    }

    try {
      // Get project ID from Expo constants
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

      console.log('[PushNotification] Project ID:', projectId);

      // Skip token fetch if no projectId configured (avoids spammy startup error)
      // User can set this via `eas init` and adding "extra.eas.projectId" to app.json
      if (!projectId) {
        console.log('[PushNotification] No projectId configured — push notifications disabled. Run `eas init` to enable.');
        // Still set up Android channels so local notifications work
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF4199',
            });
          } catch {}
        }
        return null;
      }

      // Get Expo Push Token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      token = tokenData.data;
      console.log('[PushNotification] Token:', token);

      // Store token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);


      // Android specific channel setup
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF4199',
        });

        // Create channel for followers
        await Notifications.setNotificationChannelAsync('followers', {
          name: 'New Followers',
          description: 'Notifications when someone follows you',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('messages', { name: 'Messages', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });

        // Create channel for radio updates
        await Notifications.setNotificationChannelAsync('radio', {
          name: 'Radio Updates',
          description: 'Notifications about your favorite radio stations',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });

        // Create channel for new stations
        await Notifications.setNotificationChannelAsync('new-stations', {
          name: 'New Stations',
          description: 'Notifications about new radio stations',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      return token;
    } catch (error) {
      console.error('[PushNotification] Error getting token:', error);
      return null;
    }
  },

  /**
   * Send push token to backend for storage
   * Token is sent with Authorization header (via api interceptor)
   */
  async sendPushTokenToBackend(token: string): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.user.pushToken, {
        token,                                        // "ExponentPushToken[xxxxxxx]"
        platform: Platform.OS,                        // 'ios' or 'android'
        deviceName: Device.deviceName ?? 'Unknown',   // Device name
      });
      console.log('[PushNotification] Token sent to backend successfully');
    } catch (error) {
      console.error('[PushNotification] Failed to send token to backend:', error);
      throw error;
    }
  },

  /**
   * Delete push token from backend (call on logout)
   */
  async deletePushTokenFromBackend(token: string): Promise<void> {
    try {
      await api.delete(API_ENDPOINTS.user.deletePushToken, {
        data: { token }
      });
      console.log('[PushNotification] Token deleted from backend');
      
      // Clear local storage
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    } catch (error) {
      console.error('[PushNotification] Failed to delete token from backend:', error);
    }
  },

  /**
   * Get stored push token
   */
  async getStoredPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Add listener for incoming notifications (when app is in foreground)
   */
  addNotificationListener(callback: (notification: Notifications.Notification) => void): () => void {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
  },

  /**
   * Add listener for notification interactions (when user taps on notification)
   */
  addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  },

  /**
   * Handle navigation based on notification data
   */
  handleNotificationNavigation(data: any): void {
    console.log('[PushNotification] Handling navigation with data:', data);
    
    if (!data) return;

    if (data.screen === 'group-chat' && typeof data.groupId === 'string' && /^[a-f0-9]{24}$/.test(data.groupId)) { router.push({pathname:'/group-chat',params:{groupId:data.groupId}}); return; }
    if ((data.type === 'new_message' || data.screen === 'messages' || data.url === '/profile/messages') && (data.fromUserId || data.userId)) {
      router.push({ pathname: '/messages', params: { userId: data.fromUserId || data.userId, userName: data.userName || '' } }); return;
    }
    if (data.url === '/profile/messages') { router.push('/messages'); return; }
    if (data.type === 'follow' && (data.userId || data.followerId)) { router.push({ pathname: '/user-profile', params: { userId: data.userId || data.followerId, userName: data.followerName || '' } }); return; }
    // Handle follow notification
    if (data.type === 'follow' && data.followerSlug) {
      router.push({
        pathname: '/user-profile',
        params: { 
          userId: data.followerSlug,
          userName: data.followerName || 'User',
        }
      });
      return;
    }

    // Navigate based on screen field
    if (data.screen === 'player' && data.stationId) {
      router.push({
        pathname: '/player',
        params: { stationId: data.stationId }
      });
    } else if (data.screen === 'genre' && data.genreSlug) {
      router.push({
        pathname: '/genre-detail',
        params: { slug: data.genreSlug }
      });
    } else if (data.screen === 'user-profile' && (data.userId || data.userSlug)) {
      router.push({
        pathname: '/user-profile',
        params: { userId: data.userId || data.userSlug }
      });
    } else if (data.screen === 'notifications') {
      router.push('/notifications');
    } else if (data.url) {
      router.push(data.url);
    }
  },

  /**
   * Check if notifications are enabled
   */
  async isNotificationsEnabled():Promise<boolean>{const owner=currentOwner();return !!owner&&(await readCachedPushPreference(owner))===true;},
  async setNotificationsEnabled(enabled:boolean):Promise<void>{const owner=currentOwner();if(!owner)throw Error('missing-push-owner');await savePushPreference(owner,enabled);},

};

export default pushNotificationService;
