import { dominantLogoColor } from '../utils/dominantColor';

export async function readLogoAccent(uri: string): Promise<string | null> {
  const source = __DEV__ && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1'
    ? `/__preview-logo?url=${encodeURIComponent(uri)}` : uri;
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const finish = (color: string | null, failed = false) => { clearTimeout(timeout); image.onload = image.onerror = null; if (failed) reject(new Error('Logo color sampling unavailable')); else resolve(color); };
    const timeout = setTimeout(() => finish(null, true), 8000);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { finish(null); return; }
        context.drawImage(image, 0, 0, 32, 32);
        finish(dominantLogoColor(context.getImageData(0, 0, 32, 32).data));
      } catch { finish(null, true); }
    };
    image.onerror = () => finish(null, true);
    image.src = source;
  });
}
