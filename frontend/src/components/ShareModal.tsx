import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Linking,
  StatusBar,
  Platform,
  Animated,
  useWindowDimensions} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoShadow } from './LogoShadow';
import { useLogoAccent } from '../hooks/useLogoAccent';
import { PlayerEqualizer } from './PlayerEqualizer';
import * as Clipboard from 'expo-clipboard';
import type { Station } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { resolveStationShareUrl, stationShareContent, stationShareUrl } from '../utils/stationShare';

const ARTWORK_SIZE = 150;

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  station: Station | null;
  nowPlayingTitle?: string;
  playing?: boolean;
  getLogoUrl: (station: Station) => string | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  station,
  nowPlayingTitle,
  playing = false,
  getLogoUrl,
}) => {
  const insets = useSafeAreaInsets();
  useAnalyticsOverlay('share-radio',visible);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const unit = Math.min(width, 430) / 375;
  const styles = React.useMemo(() => makeStyles(unit), [unit]);
  const logoUrl = station ? getLogoUrl(station) : null;
  const logoAccent = useLogoAccent(visible ? logoUrl : null);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'share', visible }, 'http://localhost:8082');
  }, [visible]);
  const [copied, setCopied] = useState(false);
  const preparedUrl = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setShareError(null);
    scrollY.setValue(0);
    setCopied(false);
    preparedUrl.current = station ? stationShareUrl(station) : null;
    let active = true;
    if (visible && station) resolveStationShareUrl(station).then(url => {
      if (active) preparedUrl.current = url;
    }).catch(() => {});
    return () => { active = false; generation.current++; };
  }, [visible, station]);

  if (!station) return null;

  const shareText = `${station.name} - MegaRadio`;
  const withShareUrl = async (action: (url: string) => Promise<unknown>, closeAfter = true) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = generation.current;
    setBusy(true);
    setShareError(null);
    try {
      const url = preparedUrl.current || await resolveStationShareUrl(station);
      if (request !== generation.current) return;
      await action(url);
      if (closeAfter && request === generation.current) onClose();
    } catch (error) {
      if (request === generation.current && !(error instanceof Error && error.name === 'AbortError')) setShareError(error instanceof Error ? error.message : 'Paylaşım başarısız. Tekrar deneyin.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const handleFacebookShare = () => withShareUrl(async url => {
    const facebook = `fb://share?link=${encodeURIComponent(url)}`;
    const supported = await Linking.canOpenURL(facebook).catch(() => false);
    return Linking.openURL(supported ? facebook :
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`);
  });
  const handleNativeShare = () => withShareUrl(async url => {
    const content = stationShareContent(station, url, nowPlayingTitle);
    if (Platform.OS === 'web') {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: content.title, text: content.message });
      } else {
        await Clipboard.setStringAsync(url);
        setCopied(true);
        setShareError(t('browser_share_unavailable', 'This browser cannot open the device share sheet. Link copied; you can paste it into your preferred app.'));
      }
    } else {
      await Share.share(content);
    }
  }, false);
  const handleWhatsAppShare = () => withShareUrl(async url => {
    const message = encodeURIComponent(`${shareText} ${url}`);
    const appUrl = `whatsapp://send?text=${message}`;
    const supported = await Linking.canOpenURL(appUrl).catch(() => false);
    return Linking.openURL(supported ? appUrl : `https://wa.me/?text=${message}`);
  });
  const handleTwitterShare = () => withShareUrl(url => Linking.openURL(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
  ));
  const handleMore = handleNativeShare;
  const handleCopyLink = () => withShareUrl(async url => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
  }, false);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
      testID="share-modal-dialog"
    >
      <StatusBar barStyle="light-content" backgroundColor="#1B1C1E" />
      <View style={[styles.fullScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="share-modal">
        {/* Keep the full Gaussian behind the header, outside the scroll viewport's clip. */}
        {logoAccent && <Animated.View pointerEvents="none" accessible={false}
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: Animated.multiply(scrollY, -1) }] }]}>
          <LogoShadow testID="share-logo-glow" color={logoAccent} scale={unit} opacity={0.4}
            centerX={width / (2 * unit)} centerY={insets.top / unit + 80 + 63 + ARTWORK_SIZE / 2} />
        </Animated.View>}
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{t('share', 'Share')}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            hitSlop={4}
            onPress={onClose}
            testID="share-modal-close"
            accessibilityRole="button"
            accessibilityLabel={t('close', 'Close')}
          >
            <Image source={require('../../assets/images/share/close.svg')} style={styles.closeIcon} contentFit="contain" accessible={false} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}>
        {/* Main content centered */}
        <View style={styles.content}>
          {/* Artwork with glow */}
          <View style={styles.artworkSection}>
            <View style={styles.artworkWrapper}>
                <ImageWithFallback
                  testID="share-station-logo"
                  uri={logoUrl}
                  style={styles.artwork}
                  contentFit="contain"
                />
            </View>
          </View>

          <View style={styles.stationInfo}>
            <View style={styles.equalizerSlot}><View style={{ transform: [{ scale: unit }] }}><PlayerEqualizer playing={visible && playing} /></View></View>
            <Text testID="share-station-name" style={styles.stationName} numberOfLines={1}>{station.name}</Text>
            <Text testID="share-song-title" style={styles.songTitle} numberOfLines={1}>{nowPlayingTitle || t('live_radio', 'Live Radio')}</Text>
          </View>
          {busy && <ActivityIndicator testID="share-loading" color="#FF4199" />}
          {shareError && <Text testID="share-error" accessibilityRole="alert" style={styles.shareError}>{shareError}</Text>}

          {/* Social buttons - Facebook, Instagram, Twitter, WhatsApp */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleFacebookShare}
              testID="share-facebook"
            accessibilityRole="button"
            accessibilityLabel="Facebook"
              disabled={busy}
            >
              <Image source={require('../../assets/images/share/facebook.svg')} style={styles.socialImage} contentFit="contain" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleNativeShare}
              testID="share-instagram"
              accessibilityRole="button"
              accessibilityLabel="Instagram"
              disabled={busy}
            >
              <Image source={require('../../assets/images/share/instagram.svg')} style={styles.socialImage} contentFit="contain" accessible={false} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleTwitterShare}
              testID="share-twitter"
            accessibilityRole="button"
            accessibilityLabel="Twitter"
              disabled={busy}
            >
              <Image source={require('../../assets/images/share/twitter.svg')} style={styles.socialImage} contentFit="contain" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleWhatsAppShare}
              testID="share-whatsapp"
            accessibilityRole="button"
            accessibilityLabel="WhatsApp"
              disabled={busy}
            >
              <Image source={require('../../assets/images/share/whatsapp.svg')} style={styles.socialImage} contentFit="contain" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          {/* Copy Link */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleCopyLink}
            testID="share-copy-link"
            accessibilityRole="button"
            accessibilityLabel={copied ? t('copied', 'Copied') : t('copy_link', 'Copy Link')}
            disabled={busy}
          >
            <Image source={require('../../assets/images/share/link.svg')} style={styles.linkIcon} contentFit="contain" accessible={false} />
            <Text accessibilityLiveRegion="polite" style={styles.actionText}>{copied ? t('copied', 'Copied') : t('copy_link', 'Copy Link')}</Text>
          </TouchableOpacity>

          {/* More */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleMore}
            testID="share-more"
            accessibilityRole="button"
            accessibilityLabel={t('more', 'More')}
            disabled={busy}
          >
            <Image source={require('../../assets/images/share/more.svg')} style={styles.moreIcon} contentFit="contain" accessible={false} />
            <Text style={styles.actionText}>{t('more', 'More')}</Text>
          </TouchableOpacity>
        </View>
        </Animated.ScrollView>
      </View>
    </Modal>
  );
};

// Figma share312:932,375×812. Coordinates below are relative to the44px design safe area.
const makeStyles = (u: number) => StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { width: 375 * u, height: 80 * u, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 * u },
  headerSpacer: { width: 40 * u },
  headerTitle: { fontSize: 18 * u, lineHeight: 21 * u, fontFamily: 'Ubuntu-Bold', color: '#FFFFFF', textAlign: 'center' },
  closeBtn: { width: 40 * u, height: 40 * u, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 40 * u, height: 40 * u },
  scrollContent: { alignItems: 'center', paddingBottom: 24 * u },
  content: { width: 375 * u, alignItems: 'center', marginTop: 63 * u, paddingHorizontal: 15 * u },
  artworkSection: { width: ARTWORK_SIZE * u, height: ARTWORK_SIZE * u, alignItems: 'center', justifyContent: 'center', marginBottom: 26 * u },
  artworkWrapper: { width: ARTWORK_SIZE * u, height: ARTWORK_SIZE * u, borderRadius: 14.62 * u, overflow: 'hidden', backgroundColor: '#2A2A2A' },
  artwork: { width: ARTWORK_SIZE * u, height: ARTWORK_SIZE * u },
  stationInfo: { width: '100%', height: 71 * u, alignItems: 'center' },
  equalizerSlot: { height: 28 * u, paddingTop: 3 * u, alignItems: 'center', justifyContent: 'flex-start' },
  stationName: { fontSize: 20 * u, lineHeight: 23 * u, fontFamily: 'Ubuntu-Bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 3 * u },
  songTitle: { fontSize: 15 * u, lineHeight: 17 * u, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', textAlign: 'center' },
  socialRow: { width: 282 * u, flexDirection: 'row', justifyContent: 'space-between', marginTop: 85 * u },
  socialBtn: { width: 48 * u, height: 48 * u, borderRadius: 24 * u, justifyContent: 'center', alignItems: 'center' },
  socialImage: { width: 48 * u, height: 48 * u },
  bottomActions: { width: 282 * u, alignSelf: 'center', marginTop: 33 * u },
  actionRow: { width: '100%', height: 56 * u, borderRadius: 10 * u, backgroundColor: '#282828', marginBottom: 10 * u },
  linkIcon: { position: 'absolute', width: 16 * u, height: 16 * u, left: 19 * u, top: 20 * u },
  moreIcon: { position: 'absolute', width: 24 * u, height: 6 * u, left: 12 * u, top: 25 * u },
  actionText: { position: 'absolute', left: 56 * u, right: 12 * u, top: 18 * u, fontSize: 14 * u, lineHeight: 16 * u, fontFamily: 'Ubuntu-Bold', color: '#FFFFFF' },
  shareError: { color: '#FF4199', textAlign: 'center', fontSize: 14 * u, marginBottom: 12 * u },
});

export default ShareModal;
