import {Skeleton} from './Skeleton';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

interface AvatarWithFallbackProps {
  uri: string | null | undefined;
  size: number;
  figmaFallback?: boolean;
  style?: ViewStyle;
}

export const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({ 
  uri, 
  size,
  figmaFallback = false,
  style 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  // Reset error state when URI changes
  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [uri]);
  
  // Check if we have a valid URL
  const hasValidUri = uri && typeof uri === 'string' && uri.trim().length > 0;
  
  // Build full URL if relative
  let fullUri: string | null = null;
  if (hasValidUri) {
    fullUri = uri.startsWith('http') ? uri : `https://themegaradio.com${uri}`;
  }
  
  // Show fallback if no valid URI or image failed to load
  const showFallback = !hasValidUri || imageError;
  
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };
  
  // Match the shared Mega Radio no-avatar asset.
  const renderFallback = () => figmaFallback ? <View style={[containerStyle, style]}><ExpoImage source={require('../../assets/images/profile/empty-avatar.svg')} style={{ width: size, height: size }} contentFit="contain" /></View> : (
    <View style={[containerStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect width="64" height="64" rx="32" fill="#3a3a3a" />
        <Circle cx="32" cy="26" r="11" fill="#9a9a9a" />
        <Path d="M12 60c0-11 9-19 20-19s20 8 20 19v4H12z" fill="#9a9a9a" />
      </Svg>
    </View>
  );
  
  if (showFallback) {
    return renderFallback();
  }
  
  return (
    <View style={[containerStyle, style]}>
      <ExpoImage
        key={fullUri}
        recyclingKey={fullUri}
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri: fullUri! }}
        style={{ width: size, height: size }}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
        onLoad={() => {
          setImageLoading(false);
        }}
      />
      {/* Show fallback overlay while loading or on error */}
      {imageLoading && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}><Skeleton width={size} height={size} borderRadius={size/2}/></View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AvatarWithFallback;
