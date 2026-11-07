import React, { useState } from 'react';
import { ImageSourcePropType } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';

// Default station logo - LOCAL asset for fallback (no network required)
import { DEFAULT_STATION_LOGO_SOURCE, DEFAULT_STATION_LOGO_URL } from '../utils/stationLogoHelper';

interface ImageWithFallbackProps {
  uri?: string | null;
  fallbackUri?: string;
  fallbackSource?: ImageSourcePropType | number;
  style?: any;
  /** RN-style prop; mapped to expo-image `contentFit` for backwards compatibility. */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';
  contentFit?: ImageContentFit;
  [key: string]: any;
}

// Map legacy RN `resizeMode` → expo-image `contentFit` so existing call sites
// keep the exact same visual layout. Defaults to "cover" (same as RN Image).
function toContentFit(
  resizeMode?: string,
  contentFit?: ImageContentFit,
): ImageContentFit {
  if (contentFit) return contentFit;
  switch (resizeMode) {
    case 'contain':
      return 'contain';
    case 'stretch':
      return 'fill';
    case 'center':
      return 'none';
    default:
      return 'cover';
  }
}

/**
 * Image component with automatic fallback chain + disk/memory caching (expo-image).
 * Chain: primary uri -> fallbackUri (remote) -> local fallbackSource.
 * Drop-in replacement for the previous RN-Image based version.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  uri: rawUri,
  fallbackUri: rawFallbackUri,
  fallbackSource = DEFAULT_STATION_LOGO_SOURCE,
  style,
  resizeMode,
  contentFit,
  onError,
  ...props
}) => {
  // A legacy remote placeholder is not a station image: always use our bundled
  // asset with contain, rather than downloading/cropping the site's wide logo.
  const isPlaceholder = (value?: string | null) => !!value && value.split(/[?#]/)[0].replace(/\/$/, '') === DEFAULT_STATION_LOGO_URL;
  const uri = isPlaceholder(rawUri) ? null : rawUri;
  const fallbackUri = isPlaceholder(rawFallbackUri) ? undefined : rawFallbackUri;
  // 0 = primary uri, 1 = fallbackUri (remote), 2 = local fallbackSource
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  // Reset the chain whenever the sources change (e.g., list re-uses the row).
  React.useEffect(() => {
    setStage(0);
  }, [uri, fallbackUri]);

  const fit = toContentFit(resizeMode, contentFit);
  const hasPrimary = !!(uri && uri.trim() !== '');
  const hasFallbackUri = !!(fallbackUri && fallbackUri.trim() !== '');

  // Stage 0: primary
  if (stage === 0 && hasPrimary) {
    return (
      <ExpoImage
        {...props}
        key={`primary-${uri}`}
        recyclingKey={`primary-${uri}`}
        source={{ uri: uri as string }}
        style={style}
        contentFit={fit}
        // Show the bundled image while slow or broken remote logos are loading.
        placeholder={fallbackSource}
        placeholderContentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
        onError={(event) => { setStage(hasFallbackUri ? 1 : 2); onError?.(event); }}
      />
    );
  }

  // Stage 1 (or no primary but has fallbackUri): remote fallback URL
  if (stage <= 1 && hasFallbackUri) {
    return (
      <ExpoImage
        {...props}
        key={`secondary-${fallbackUri}`}
        recyclingKey={`secondary-${fallbackUri}`}
        source={{ uri: fallbackUri as string }}
        style={style}
        contentFit={fit}
        placeholder={fallbackSource}
        placeholderContentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
        onError={(event) => { setStage(2); onError?.(event); }}
      />
    );
  }

  // Final: local fallback asset (never fails)
  return <ExpoImage {...props} key="local-fallback" recyclingKey="local-fallback"
    source={fallbackSource} style={style} contentFit="contain" />;
};

export default ImageWithFallback;
