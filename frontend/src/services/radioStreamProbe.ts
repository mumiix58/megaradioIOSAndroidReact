import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/** Secondary muted decoder; progress is required, not merely an HTTP response or metadata. */
export async function probeRadioStream(url: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  if (Platform.OS === 'android') await setAudioModeAsync({ interruptionMode: 'mixWithOthers' });
  if (signal.aborted) return false;
  return new Promise(resolve => {
    let audio: AudioPlayer | undefined, subscription: { remove: () => void } | undefined;
    let done = false, start: number | null = null;
    const finish = (valid: boolean) => {
      if (done) return; done = true; clearTimeout(timeout);
      signal.removeEventListener('abort', abort); subscription?.remove(); audio?.remove(); resolve(valid);
    };
    const abort = () => finish(false);
    const timeout = setTimeout(() => finish(false), 5500);
    signal.addEventListener('abort', abort, { once: true });
    try {
      audio = createAudioPlayer(url, { updateInterval: 100, keepAudioSessionActive: true });
      audio.muted = true; audio.volume = 0;
      subscription = audio.addListener('playbackStatusUpdate', status => {
        if (status.playbackState === 'error' || status.playbackState === 'failed') { finish(false); return; }
        if (!status.isLoaded || !status.playing || status.isBuffering) return;
        if (start === null) start = status.currentTime;
        else if (status.currentTime - start >= 0.15) finish(true);
      });
      audio.play();
    } catch { finish(false); }
  });
}
