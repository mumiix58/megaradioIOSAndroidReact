// NotificationHandler - Manages push notification registration and handling
// Must be used at the top level of the app to catch all notifications
// NOTE: This component only works on native platforms (iOS/Android), not web

import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef } from 'react';
import { Platform,AppState } from 'react-native';
import {getPushPreference} from '../services/notificationPreferences';
import { useAuthStore } from '../store/authStore';

// Only import notification modules on native platforms
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const NotificationHandler: React.FC = () => {
  const queryClient = useQueryClient();
  const hasRegistered = useRef(false);
  const { isAuthenticated, user, token: authToken } = useAuthStore();
  
  // Refresh the server preference on login/resume without prompting for OS access.
  useEffect(()=>{
    if(!isNative||!isAuthenticated||!authToken){hasRegistered.current=false;return;}
    const owner=user?._id||user?.id;if(!owner)return;
    let active=true,running=false;
    hasRegistered.current=false;
    const current=()=>{const auth=useAuthStore.getState();return active&&auth.isAuthenticated&&auth.token===authToken&&(auth.user?._id||auth.user?.id)===owner;};
    const register=async()=>{
      if(running)return;running=true;
      try{
        const enabled=await getPushPreference(owner);
        if(!enabled||!current()||hasRegistered.current)return;
        const service=(await import('../services/pushNotificationService')).default;
        const token=await service.registerForPushNotifications();
        if(!token||!current())return;
        await service.sendPushTokenToBackend(token);
        if(current())hasRegistered.current=true;
      }catch(error){console.error('[NotificationHandler] Push registration unavailable',error);}
      finally{running=false;}
    };
    void register();const sub=AppState.addEventListener('change',state=>{if(state==='active')void register();});
    return()=>{active=false;sub.remove();};
  },[isAuthenticated,authToken,user?._id,user?.id]);

  // Set up notification listeners (native only)
  useEffect(() => {
    if (!isNative) {
      return;
    }
    
    let disposed=false;
    let navigationTimer:ReturnType<typeof setTimeout>|undefined;
    let foregroundSubscription: (() => void) | null = null;
    let responseSubscription: (() => void) | null = null;
    
    const setupListeners = async () => {
      try {
        const pushNotificationService = (await import('../services/pushNotificationService')).default;
        const Notifications = await import('expo-notifications');
        if(disposed)return;
        
        console.log('[NotificationHandler] Setting up notification listeners...');
        
        // Listener for when notification is received while app is in foreground
        foregroundSubscription = pushNotificationService.addNotificationListener(
          () => {
            console.log('[NotificationHandler] Received notification in foreground');
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            void queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
            void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
          }
        );
        
        // Listener for when user taps on a notification
        responseSubscription = pushNotificationService.addNotificationResponseListener(
          (response: any) => {
            console.log('[NotificationHandler] User tapped notification');
            const data = response.notification.request.content.data;
            if (data) {
              pushNotificationService.handleNotificationNavigation(data);
            }
          }
        );
        
        // Handle notification that opened the app (cold start)
        try {
          const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
          
          if (lastNotificationResponse) {
            console.log('[NotificationHandler] App opened from notification');
            const data = lastNotificationResponse.notification.request.content.data;
            
            navigationTimer=setTimeout(() => {
              if (data) {
                pushNotificationService.handleNotificationNavigation(data);
              }
            }, 1000);
          }
        } catch (e) {
          // Silently ignore - method not available
        }
        
      } catch (error) {
        console.error('[NotificationHandler] Failed to setup listeners:', error);
      }
    };
    
    setupListeners();
    
    // Cleanup
    return () => {
      disposed=true;if(navigationTimer)clearTimeout(navigationTimer);
      console.log('[NotificationHandler] Cleaning up listeners');
      if (foregroundSubscription) foregroundSubscription();
      if (responseSubscription) responseSubscription();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default NotificationHandler;
