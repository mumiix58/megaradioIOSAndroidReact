import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AvatarWithFallback } from './AvatarWithFallback';
import { ChatAvatar } from './chat/ChatAvatar';
import type { ChatUser } from '../services/chatService';

export function ProfilePhotoViewer({ visible, onClose, uri, name, person }: {
  visible: boolean; onClose: () => void; uri?: string | null; name: string; person?: ChatUser | null;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [presented, setPresented] = useState(visible);
  const [frame, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useLayoutEffect(() => {
    const listener = progress.addListener(({ value }) => setFrame(value));
    return () => progress.removeListener(listener);
  }, [progress]);
  useLayoutEffect(() => {
    if (visible) setPresented(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 180 : 140, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished && !visible) setPresented(false); });
    return () => animation.stop();
  }, [visible, progress, reduceMotion]);
  useLayoutEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'profilePhotoProgress', visible: frame }, 'http://localhost:8082');
    }
  }, [frame]);
  useEffect(() => () => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'profilePhotoProgress', visible: 0 }, 'http://localhost:8082');
  }, []);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const size = Math.max(80, Math.min(340, width - 48, height - insets.top - insets.bottom - 160));
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [visible, onClose]);
  return <Modal visible={visible || presented} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.overlay} accessibilityViewIsModal testID="profile-photo-viewer">
      <BlurView intensity={24 * frame} tint="default" style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} pointerEvents="none" />
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim, { opacity: frame }]} onPress={onClose} accessible={false} testID="profile-photo-backdrop" />
      <View style={[styles.portrait, { opacity: frame, transform: [{ scale: 0.96 + 0.04 * frame }] }]} accessible accessibilityLabel={name}>
        <View>
          {person ? <ChatAvatar person={person} size={size} /> : <AvatarWithFallback uri={uri} size={size} figmaFallback />}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoRim, { borderRadius: size / 2 }]} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
      </View>
      <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 12, opacity: frame }]} accessibilityRole="button" accessibilityLabel={t('close', 'Close')} testID="profile-photo-close">
        <Image source={require('../../assets/images/rate-us/close-circle.svg')} style={styles.closeIcon} contentFit="contain" />
      </Pressable>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.72)' },
  portrait: { alignItems: 'center', gap: 20, maxWidth: '90%' },
  photoRim: { borderWidth: 1, borderColor: 'rgba(255,65,153,0.6)' },
  name: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 24, textAlign: 'center' },
  close: { position: 'absolute', right: 12, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 38, height: 38 },
});
