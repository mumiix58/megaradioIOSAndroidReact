// QuickActionsHandler - "Play Last Station" shortcut via app icon long-press
// iOS: Home Screen Quick Actions | Android: App Shortcuts (expo-quick-actions)
// Must be used inside AudioProvider to access playStation function
// Fully async - never blocks startup

import { useEffect, useRef, useContext } from 'react';
import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioContext } from '../providers/AudioProvider';
import { usePlayerStore } from '../store/playerStore';
import { reportLaunchSource } from '../services/launchSourceService';
import i18n from '../services/i18nService';

const LAST_PLAYED_STATION_KEY = '@megaradio_last_played_station';

const getQuickActions = () => {
  try {
    return require('expo-quick-actions');
  } catch (e) {
    return null;
  }
};

export const QuickActionsHandler: React.FC = () => {
  const playStation = useContext(AudioContext)?.playStation;
  const playStationRef = useRef(playStation);
  playStationRef.current = playStation;
  const handledInitial = useRef(false);
  const playbackPending = useRef(false);
  const { currentStation } = usePlayerStore();

  const playLastStation = async () => {
    if (!playStationRef.current || playbackPending.current) return;
    playbackPending.current = true;
    try {
      const raw = await AsyncStorage.getItem(LAST_PLAYED_STATION_KEY);
      if (!raw) {
        console.log('[QuickActions] No last played station stored');
        return;
      }
      const station = JSON.parse(raw);
      if (!station || !station._id) return;
      console.log('[QuickActions] Playing last station:', station.name);
      // A voice command means PLAY, not toggle/pause an already playing station.
      const current = usePlayerStore.getState();
      if (current.currentStation?._id !== station._id || current.playbackState !== 'playing') {
        await playStationRef.current?.(station);
      }
    } catch (e) {
      console.log('[QuickActions] Play failed:', (e as any)?.message || e);
    } finally {
      playbackPending.current = false;
    }
  };

  const handleAction = (action: any) => {
    if (action?.id === 'play-last' || action?.params?.action === 'play-last') {
      reportLaunchSource('quick_action');
      playLastStation();
    }
  };

  // Listener + cold-start initial action
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const QuickActions = getQuickActions();
    if (!QuickActions) return;

    let disposed = false;
    let initialTimer: ReturnType<typeof setTimeout> | undefined;
    const sub = QuickActions.addListener?.(handleAction);

    // App launched (cold start) via the shortcut — wait for stores/player to settle
    if (!handledInitial.current && QuickActions.initial) {
      handledInitial.current = true;
      const initial = QuickActions.initial;
      initialTimer = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => { if (!disposed) handleAction(initial); });
      }, 2000);
    }

    return () => { disposed = true; clearTimeout(initialTimer); sub?.remove?.(); };
  }, []);

  // Voice assistant deep link (iOS Siri App Shortcut / Android Google Assistant
  // App Action): both dispatch megaradio://?playLast=1
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const { Linking } = require('react-native');
    let disposed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const handleUrl = (url: string | null) => {
      if (!url || disposed) return;
      let parsed: URL;
      try { parsed = new URL(url); } catch { return; }
      if (parsed.protocol !== 'megaradio:' || parsed.searchParams.get('playLast') !== '1') return;
      console.log('[QuickActions] Voice assistant playLast deep link received');
      reportLaunchSource(parsed.searchParams.get('source') === 'quick_action'
        ? 'quick_action' : Platform.OS === 'ios' ? 'siri' : 'assistant');
      const timer = setTimeout(() => {
        timers.delete(timer);
        InteractionManager.runAfterInteractions(() => { if (!disposed) void playLastStation(); });
      }, 500);
      timers.add(timer);
    };
    const sub = Linking.addEventListener('url', (ev: any) => handleUrl(ev?.url));
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    return () => { disposed = true; timers.forEach(clearTimeout); sub?.remove?.(); };
  }, []);

  // Register/update the shortcut items (deferred, non-blocking)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const QuickActions = getQuickActions();
    if (!QuickActions) return;

    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          let subtitle: string | undefined;
          try {
            const raw = await AsyncStorage.getItem(LAST_PLAYED_STATION_KEY);
            if (raw) subtitle = JSON.parse(raw)?.name;
          } catch (e) {}

          await QuickActions.setItems([
            {
              id: 'play-last',
              title: i18n.t('quick_action_play_last', { defaultValue: 'Son Çalınanı Çal' }),
              subtitle,
              icon: Platform.OS === 'ios' ? 'symbol:play.circle' : undefined,
              params: { action: 'play-last' },
            },
          ]);
          console.log('[QuickActions] Shortcut registered', subtitle ? `(${subtitle})` : '');
        } catch (e) {
          console.log('[QuickActions] setItems failed:', (e as any)?.message || e);
        }
      });
    }, 5000);

    return () => clearTimeout(timer);
    // Re-register when the playing station changes so the subtitle stays fresh
  }, [currentStation?._id]);

  return null;
};

export default QuickActionsHandler;
