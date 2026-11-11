import { Image } from 'expo-image';
// Reuse the decoder shipped with our pinned Expo Image 3 SDK; no native module added.
import decodeBlurhash from 'expo-image/src/utils/blurhash/decode';
import { dominantLogoColor } from '../utils/dominantColor';

export async function readLogoAccent(uri: string): Promise<string | null> {
  const image = await Image.loadAsync(uri, { maxWidth: 32, maxHeight: 32 });
  try {
    const hash = await Image.generateBlurhashAsync(image, [9, 9]);
    return hash ? dominantLogoColor(decodeBlurhash(hash, 32, 32)) : null;
  } finally { image.release(); }
}
