import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AudioContext } from './AudioProvider';
import { NativeCastContext } from '../contexts/NativeCastContext';
import { useCastTransfer } from '../hooks/useCastTransfer';
import { usePlayerStore } from '../store/playerStore';
import { GoogleCast } from '../services/nativeCasting';

/** One native Cast session survives navigation between player, home and search. */
export function NativeCastProvider({ children }: { children: React.ReactNode }) {
  const audio = useContext(AudioContext);
  const { currentStation, streamUrl, nowPlaying } = usePlayerStore();
  // RootLayout initializes i18n in an effect; do not suspend that first commit.
  const { t } = useTranslation(undefined, { useSuspense: false });
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(message); timer.current = setTimeout(() => setNotice(null), 3500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cast = useCastTransfer({ station: currentStation, streamUrl, nowPlaying, pauseLocal: audio?.pause,
    onError: () => notify(t('cast_transfer_failed', 'Could not cast. Playback on your phone continues.')) });
  const { client, remoteStationId } = cast;
  const previousRemoteStation = useRef<string | null>(null);
  useEffect(() => {
    if (previousRemoteStation.current && !remoteStationId && usePlayerStore.getState().currentStation?._id === previousRemoteStation.current) usePlayerStore.getState().setPlaybackState('paused');
    previousRemoteStation.current = remoteStationId;
  }, [remoteStationId]);
  useEffect(() => {
    if (!client || !remoteStationId) return;
    let active = true;
    const update = (status: any) => {
      if (!active || usePlayerStore.getState().currentStation?._id !== remoteStationId) return;
      if (status?.playerState === 'playing' || status?.playerState === 'paused' || status?.playerState === 'buffering') usePlayerStore.getState().setPlaybackState(status.playerState);
    };
    const subscription = client.onMediaStatusUpdated(update);
    client.getMediaStatus().then(update).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, [client, remoteStationId]);
  const command = useCallback(async (action: 'pause' | 'play' | 'toggle') => {
    if (!client) return;
    try {
      const status = action === 'toggle' ? await client.getMediaStatus() : null;
      if (action === 'pause' || action === 'toggle' && status?.playerState !== 'paused') {
        await client.pause(); usePlayerStore.getState().setPlaybackState('paused');
      } else { await client.play(); usePlayerStore.getState().setPlaybackState('playing'); }
    } catch { notify(t('cast_connection_failed', 'Could not connect. Please try again.')); }
  }, [client, notify, t]);
  const stop = useCallback(async () => {
    try { await GoogleCast?.getSessionManager().endCurrentSession(true); return true; }
    catch { notify(t('cast_connection_failed', 'Could not connect. Please try again.')); return false; }
  }, [notify, t]);
  const value = useMemo(() => ({ connected: cast.connected, remoteStationId, arm: cast.arm, notify,
    pause: () => command('pause'), resume: () => command('play'), togglePlayPause: () => command('toggle'), stop,
  }), [cast.connected, remoteStationId, cast.arm, notify, command, stop]);
  return <NativeCastContext.Provider value={value}>{children}{notice && <View style={[styles.notice, { bottom: insets.bottom + 90 }]} pointerEvents="none" testID="player-cast-notice"><Text style={styles.text} accessibilityLiveRegion="polite">{notice}</Text></View>}</NativeCastContext.Provider>;
}
const styles = StyleSheet.create({
  notice: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, backgroundColor: '#282828', zIndex: 1000 },
  text: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 18, textAlign: 'center' },
});
