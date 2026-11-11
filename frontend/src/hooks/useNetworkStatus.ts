// useNetworkStatus - Hook to monitor network connectivity
// Shows offline banner when cache data is being used

import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  isOffline: boolean;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    isOffline: false,
  });

  const updateNetworkStatus = useCallback((state: NetInfoState) => {
    const isWifi = state.type === 'wifi';
    const isCellular = state.type === 'cellular';
    const isConnected = state.isConnected ?? true;
    const isInternetReachable = state.isInternetReachable;
    
    // Consider offline if not connected OR internet not reachable
    const isOffline = !isConnected || isInternetReachable === false;
    
    setNetworkStatus({
      isConnected,
      isInternetReachable,
      type: state.type,
      isWifi,
      isCellular,
      isOffline,
    });
    
    console.log('[NetworkStatus] Updated:', {
      isConnected,
      isInternetReachable,
      type: state.type,
      isOffline,
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setNetworkStatus(previous => ({
        ...previous, isConnected: navigator.onLine, isInternetReachable: navigator.onLine, isOffline: !navigator.onLine,
      }));
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }

    // Get initial state
    NetInfo.fetch().then(updateNetworkStatus);

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkStatus);

    return () => {
      unsubscribe();
    };
  }, [updateNetworkStatus]);

  return networkStatus;
};

export default useNetworkStatus;
