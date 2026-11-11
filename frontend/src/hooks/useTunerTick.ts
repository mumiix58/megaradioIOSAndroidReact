import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { usePlayerStore } from '../store/playerStore';

/** Local 22 ms mechanical tick; never changes the radio's audio-session configuration. */
export function useTunerTick() {
  const player = useRef<AudioPlayer | null>(null), last = useRef(0), seeking = useRef(false);
  useEffect(() => {
    let mounted = true;
    const prepare = async () => {
      // Android's secondary effects engine must not request focus from TrackPlayer.
      if (Platform.OS === 'android') await setAudioModeAsync({ interruptionMode: 'mixWithOthers' });
      if (!mounted) return;
      // Completing a short effect must not deactivate iOS's shared radio session.
      const audio = createAudioPlayer(require('../../assets/sounds/tuner-tick.wav'), { keepAudioSessionActive: true });
      audio.volume = 0.12; player.current = audio;
    };
    void prepare().catch(() => {});
    return () => { mounted = false; const audio = player.current; player.current = null; audio?.remove(); };
  }, []);
  return useCallback(() => {
    const now = Date.now(), audio = player.current;
    if (!audio || seeking.current || now - last.current < 65 || usePlayerStore.getState().volume === 0) return;
    last.current = now; seeking.current = true;
    void audio.seekTo(0).then(() => { if (player.current === audio) audio.play(); }).catch(() => {}).finally(() => { seeking.current = false; });
  }, []);
}
