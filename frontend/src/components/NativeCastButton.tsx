import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AirplayButton, CastButton } from '../services/nativeCasting';
import { useNativeCast } from '../contexts/NativeCastContext';

interface NativeCastButtonProps {
  size?: number;
  color?: string;
  activeColor?: string;
  onFeedback?: (message: string) => void;
  disabled?: boolean;
}

export function NativeCastButton({ size = 26, color = '#FFFFFF', activeColor = '#FF4199', onFeedback, disabled = false }: NativeCastButtonProps) {
  const { t } = useTranslation();
  const { arm, connected, notify } = useNativeCast();
  const feedback = onFeedback || notify;
  const label = t('cast_title', 'Cast to device');
  const icon = <Image source={require('../../assets/images/player/mirroring-screen.svg')} style={{ width: size, height: size }} tintColor={connected ? activeColor : color} contentFit="contain" accessible={false} />;
  if (CastButton || AirplayButton) {
    return <View style={s.button} pointerEvents={disabled ? 'none' : 'auto'} accessibilityElementsHidden={disabled} importantForAccessibility={disabled ? 'no-hide-descendants' : 'auto'} testID="player-cast-button">
      <View pointerEvents="none">{icon}</View>
      {/* Keep the chosen MegaRadio icon; the real native button owns the tap and permission flow. */}
      {CastButton ? <CastButton style={StyleSheet.absoluteFill} tintColor="transparent" onTouchStart={arm} accessibilityLabel={label} accessibilityState={{ disabled }} />
        : <AirplayButton style={StyleSheet.absoluteFill} tintColor="transparent" activeTintColor="transparent" prioritizesVideoDevices={false} accessibilityLabel={label} />}
    </View>;
  }
  return <TouchableOpacity style={s.button} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} testID="player-cast-button" onPress={() => feedback(t(Platform.OS === 'web' ? 'cast_web_unavailable' : 'cast_unavailable', 'Casting is available in the mobile app.'))}>{icon}</TouchableOpacity>;
}
const s = StyleSheet.create({ button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } });
export default NativeCastButton;
