import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { profileShareContent } from '../utils/profileShare';

type Content = Awaited<ReturnType<typeof profileShareContent>>;
export function ProfileShareSheet({ visible, onClose, profile, preview = false }: { visible: boolean; onClose: () => void; profile?: Parameters<typeof profileShareContent>[0]; preview?: boolean }) {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const owner = user?._id || user?.id;
  const subject: Parameters<typeof profileShareContent>[0] | null | undefined = profile || user;
  const subjectId = subject?.slug || subject?._id || subject?.id;
  const identity = `${owner || ''}:${subjectId || ''}`;
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  const [contentIdentity, setContentIdentity] = useState('');
  const { width, height } = useWindowDimensions();
  const unit = Math.min(width, 430) / 375;
  const s = React.useMemo(() => makeStyles(unit), [unit]);
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(288 * unit + insets.bottom, height - insets.top - 24);
  const progress = useRef(new Animated.Value(0)).current;
  const [presented, setPresented] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const mounted = visible || presented;
  useAnalyticsOverlay('share-profile',mounted);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!visible || !subject) return;
    if (preview) { setContent(null); setContentIdentity(''); setError(''); setCopied(false); setLoading(false); return; }
    let active = true;
    setContent(null); setContentIdentity(''); setCopied(false); setError(''); setLoading(true);
    void profileShareContent(subject).then(value => {
      if (active) { setContent(value); setContentIdentity(identity); }
    }).catch(reason => { if (active) setError(!profile && reason instanceof Error && !/Request failed|Network Error|timeout/i.test(reason.message) ? reason.message : t('profile_share_failed', 'Unable to share this profile.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, identity, subject, preview, t]);
  useLayoutEffect(() => {
    if (visible) setPresented(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 280 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && !visible) {
        setPresented(false);
        const action = pendingAction.current; pendingAction.current = null;
        action?.();
      }
    });
    return () => animation.stop();
  }, [visible, progress, reduceMotion]);
  useEffect(() => {
    if (!(__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1')) return;
    const notify = (screen: string, visible: boolean | number) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen, visible }, 'http://localhost:8082');
    notify('profileShare', mounted);
    if (!mounted) return;
    const listener = progress.addListener(({ value }) => notify('profileShareProgress', value));
    return () => { progress.removeListener(listener); notify('profileShare', false); notify('profileShareProgress', 0); };
  }, [mounted, progress]);
  const validContent = () => content && contentIdentity === identity && (useAuthStore.getState().user?._id || useAuthStore.getState().user?.id) === owner ? content : null;
  const report = (reason: unknown) => {
    if (reason instanceof Error && reason.name === 'AbortError') return;
    setError(t('profile_share_failed', 'Unable to share this profile. Please try again.'));
  };
  const systemShare = (value: Content) => {
    if (Platform.OS === 'web') {
      // Web Share requires the original button gesture; do not delay it until after animation.
      if (typeof navigator.share === 'function') {
        void navigator.share({ title: value.title, text: value.message }).then(onClose).catch(report);
      } else {
        void Clipboard.setStringAsync(value.url).then(() => {
          setCopied(true);
          setError(t('browser_share_unavailable', 'This browser cannot open the device share sheet. Link copied; you can paste it into your preferred app.'));
        }).catch(report);
      }
      return;
    }
    pendingAction.current = () => {
      if (currentIdentity.current !== identity || (useAuthStore.getState().user?._id || useAuthStore.getState().user?.id) !== owner) return;
      void Share.share({ title: value.title, message: value.message }).catch(reason => {
        if (!(reason instanceof Error && reason.name === 'AbortError')) Alert.alert(t('share', 'Share'), t('profile_share_failed', 'Unable to share this profile. Please try again.'));
      });
    };
    onClose();
  };
  const shareSocial = async (platform: 'facebook' | 'instagram' | 'twitter' | 'whatsapp') => {
    const value = validContent(); if (!value) return;
    if (platform === 'instagram') { systemShare(value); return; }
    try {
      const url = encodeURIComponent(value.url), message = encodeURIComponent(value.message);
      if (platform === 'facebook') await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(value.title)}`);
      else if (platform === 'twitter') await Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(value.title)}&url=${url}`);
      else {
        const appUrl = `whatsapp://send?text=${message}`;
        const canOpen = Platform.OS !== 'web' && await Linking.canOpenURL(appUrl).catch(() => false);
        await Linking.openURL(canOpen ? appUrl : `https://wa.me/?text=${message}`);
      }
    } catch (reason) { report(reason); }
  };
  const copy = async () => {
    const value = validContent(); if (!value) return;
    try { await Clipboard.setStringAsync(value.url); setCopied(true); setError(''); } catch (reason) { report(reason); }
  };
  if (!mounted) return null;
  const disabled = preview || loading || !content;
  return <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent testID="profile-share-modal">
    <View style={s.overlay}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.31)', opacity: progress }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close', 'Close')} testID="profile-share-dismiss" />
      <Animated.View style={[s.sheet, { height: sheetHeight, paddingBottom: insets.bottom, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight + 24, 0] }) }] }]} testID="profile-share-sheet" accessibilityViewIsModal>
        <TouchableOpacity style={s.grabberArea} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close', 'Close')}><View style={s.grabber} /></TouchableOpacity>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.socials}>
            {([
              ['facebook', 'Facebook', require('../../assets/images/profile-share/facebook.svg')],
              ['instagram', 'Instagram', require('../../assets/images/profile-share/instagram.svg')],
              ['twitter', 'Twitter', require('../../assets/images/profile-share/twitter.svg')],
              ['whatsapp', 'WhatsApp', require('../../assets/images/profile-share/whatsapp.svg')],
            ] as const).map(([platform, label, source]) => <TouchableOpacity key={platform} disabled={disabled} onPress={() => void shareSocial(platform)} accessibilityRole="button" accessibilityLabel={label} testID={`profile-share-${platform}`} style={[s.socialTouch, platform === 'instagram' && { transform: [{ translateY: unit }] }]}>
              <Image source={source} style={s.socialIcon} contentFit="contain" />
            </TouchableOpacity>)}
          </View>
          <View style={s.feedback}>
            {loading && <ActivityIndicator size="small" color="#FF4199" />}
            {!!error && <Text accessibilityRole="alert" style={s.error} numberOfLines={2} testID="profile-share-error">{error}</Text>}
          </View>
          <TouchableOpacity style={s.action} disabled={disabled} onPress={() => void copy()} accessibilityRole="button" accessibilityLabel={copied ? t('copied', 'Copied') : t('copy_link', 'Copy Link')} testID="profile-share-copy">
            <Image source={require('../../assets/images/profile-share/link.svg')} style={s.link} contentFit="contain" accessible={false} />
            <Text style={s.actionText}>{copied ? t('copied', 'Copied') : t('copy_link', 'Copy Link')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.action, { marginTop: 10 * unit }]} disabled={disabled} onPress={() => { const value = validContent(); if (value) systemShare(value); }} accessibilityRole="button" accessibilityLabel={t('more', 'More')} testID="profile-share-more">
            <Image source={require('../../assets/images/profile-share/more.svg')} style={s.more} contentFit="contain" accessible={false} />
            <Text style={s.actionText}>{t('more', 'More')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
// Figma share-profile1750:5282:322px sheet includes34px bottom safe area.
const makeStyles = (u: number) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: 375 * u, alignSelf: 'center', backgroundColor: '#000000', borderTopLeftRadius: 20 * u, borderTopRightRadius: 20 * u, overflow: 'hidden' },
  grabberArea: { height: 44 * u, alignItems: 'center', paddingTop: 20 * u },
  grabber: { width: 50 * u, height: 6 * u, borderRadius: 4 * u, backgroundColor: '#676767' },
  content: { alignItems: 'center', paddingTop: 22 * u, paddingBottom: 19 * u },
  socials: { width: 264 * u, flexDirection: 'row', justifyContent: 'space-between' },
  socialTouch: { width: 48 * u, height: 49 * u },
  socialIcon: { width: 48 * u, height: 48 * u },
  action: { width: 282 * u, height: 56 * u, borderRadius: 10 * u, backgroundColor: '#282828' },
  link: { position: 'absolute', width: 16 * u, height: 16 * u, left: 19 * u, top: 20 * u },
  more: { position: 'absolute', width: 24 * u, height: 6 * u, left: 12 * u, top: 25 * u },
  actionText: { position: 'absolute', left: 56 * u, right: 12 * u, top: 18 * u, fontFamily: 'Ubuntu-Bold', fontSize: 14 * u, lineHeight: 16 * u, color: '#FFFFFF' },
  feedback: { height: 32 * u, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Ubuntu-Regular', fontSize: 11 * u, lineHeight: 14 * u, color: '#FF83B8', maxWidth: 282 * u, textAlign: 'center' },
});
