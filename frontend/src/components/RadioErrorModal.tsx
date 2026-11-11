import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useSegments } from 'expo-router';
import { usePlayerStore } from '../store/playerStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { PlayerErrorState } from './PlayerErrorState';

/** Outside the player, retain the dismissible notice. The player owns its persistent inline error. */
export const RadioErrorModal: React.FC = () => {
  const { playbackState, currentStation, isMiniPlayerVisible } = usePlayerStore();
  const { isOffline } = useNetworkStatus();
  const segments = useSegments();
  const onPlayer = segments.some(segment => segment === 'player');
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
    if (playbackState !== 'error' || onPlayer || isOffline) return;
    const timer = setTimeout(() => setDismissed(true), 4000);
    return () => clearTimeout(timer);
  }, [playbackState, currentStation?._id, onPlayer, isOffline]);

  const visible = playbackState === 'error' && !onPlayer && !isOffline && !isMiniPlayerVisible && !dismissed;
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setDismissed(true)}>
    <TouchableOpacity testID="radio-error-modal" style={styles.overlay} activeOpacity={1} onPress={() => setDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss radio error">
      <PlayerErrorState />
    </TouchableOpacity>
  </Modal>;
};
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
});
export default RadioErrorModal;
