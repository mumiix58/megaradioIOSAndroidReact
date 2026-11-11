import { createSubmissionLock } from '../src/utils/submissionLock';
import analyticsService from '../src/services/analyticsService';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LoginFrequency } from '../src/components/LoginFrequency';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,

  useWindowDimensions,
  Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ProfilePhotoFeedback } from '../src/components/ProfilePhotoFeedback';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import socialAuthService, { SocialProvider } from '../src/services/socialAuthService';
import { useAuthStore } from '../src/store/authStore';

// Auth button icons from assets
const APPLE_ICON = require('../assets/images/auth/figma/apple.svg');
const FACEBOOK_ICON = require('../assets/images/auth/figma/facebook.svg');
const GOOGLE_ICON = require('../assets/images/auth/figma/google.svg');
const MAIL_ICON = require('../assets/images/auth/figma/mail.svg');


export default function AuthOptionsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = Math.min(width / 375, height / 812);
  const left = (width - 375 * scale) / 2;
  const [notice, setNotice] = useState<{error: boolean; message: string} | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  useEffect(() => {
    if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY !== '1') return;
    const send = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'startup', visible }, 'http://localhost:8082');
    send(true); return () => send(false);
  }, []);
  const params = useLocalSearchParams<{ returnTo?: string; returnParams?: string }>();
  const { t } = useTranslation();
  const { saveAuth } = useAuthStore();
  const [submissionLock] = useState(createSubmissionLock);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  // Parse return params for redirect after login
  const returnTo = params.returnTo;
  const returnParams = (() => {
    try { return params.returnParams ? JSON.parse(params.returnParams) : null; } catch { return null; }
  })();

  const navigateAfterLogin = () => {
    if (returnTo && returnParams) {
      // Navigate back to the screen that triggered login
      router.replace({
        pathname: returnTo as any,
        params: returnParams
      });
    } else {
      // Default: go to home
      router.replace('/(tabs)');
    }
  };

  const showError = (message: string) => setNotice({ error: true, message });

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!submissionLock.tryAcquire()) return;
    setLoadingProvider(provider);
    
    try {
      let result;
      
      switch (provider) {
        case 'google':
          result = await socialAuthService.signInWithGoogle();
          break;
        case 'apple':
          result = await socialAuthService.signInWithApple();
          break;
        case 'facebook':
          result = await socialAuthService.signInWithFacebook();
          break;
      }
      
      if (result.success && result.token && result.user) {
        // Save auth and navigate
        await saveAuth(result.user, result.token);
        void analyticsService.logLogin(provider);
        navigateAfterLogin();
      } else if (result.error === 'Authentication cancelled') {
        // User cancelled - do nothing
        console.log('User cancelled authentication');
      } else {
        showError(result.error || 'Giriş başarısız oldu');
      }
    } catch (error: any) {
      console.error(`${provider} login error:`, error);
      showError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoadingProvider(null);
      submissionLock.release();
    }
  };


  const handleMailLogin = () => {
    // Pass return params to login screen
    if (returnTo && returnParams) {
      router.push({
        pathname: '/login',
        params: {
          returnTo,
          returnParams: JSON.stringify(returnParams)
        }
      });
    } else {
      router.push('/login');
    }
  };

  const handleContinueWithoutLogin = () => {
    router.replace('/(tabs)');
  };

  const handleClose = () => {
    // Navigate back or to home if there's no navigation history
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const isLoading = loadingProvider !== null;

  const providers = [
    { provider: 'apple', icon: APPLE_ICON, label: t('login_with_apple', 'Apple ile Giriş Yap') },
    { provider: 'google', icon: GOOGLE_ICON, label: t('login_with_google', 'Google ile Giriş Yap') },
    { provider: 'facebook', icon: FACEBOOK_ICON, label: t('login_with_facebook', 'Facebook ile Giriş Yap') },
    { provider: 'mail', icon: MAIL_ICON, label: t('login_with_mail', 'E-posta ile Giriş Yap') },
  ] as const;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('close', 'Kapat')}
        style={[styles.closeButton, { top: Math.max(insets.top + 10, 62 * scale), right: left + 24 * scale,
          width: 40 * scale, height: 40 * scale }]}
        onPress={handleClose} testID="auth-close-button">
        <Ionicons name="close" size={24 * scale} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={{ position: 'absolute', left: left + 25 * scale, top: 122 * scale }}>
        <LoginFrequency size={326 * scale} />
      </View>
      <View style={{ position: 'absolute', left: left + 33 * scale, top: 390 * scale, width: 310 * scale, gap: 20 * scale }}>
        {providers.map(({ provider, icon, label }) => (
          <TouchableOpacity key={provider} accessibilityRole="button" accessibilityLabel={label}
            style={[styles.authButton, { height: 60 * scale, borderRadius: 30 * scale, paddingHorizontal: 11 * scale }, isLoading && styles.authButtonDisabled]}
            onPress={() => provider === 'mail' ? handleMailLogin() : handleSocialLogin(provider)}
            accessibilityState={{disabled:isLoading,busy:loadingProvider===provider}} disabled={isLoading} testID={`login-${provider}-button`}>
            {loadingProvider === provider ? <ActivityIndicator style={{ width: 38 * scale }} size="small" color="#FFFFFF" /> :
              <Image source={icon} style={{ width: 38 * scale, height: 38 * scale }} contentFit="contain" />}
            <Text style={[styles.authButtonText, { fontSize: 15 * scale, marginRight: 38 * scale }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={handleContinueWithoutLogin} disabled={isLoading}
        style={{ position: 'absolute', left: 0, right: 0, top: 715 * scale, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        testID="continue-without-login-button">
        <Text style={[styles.continueButtonText, { fontSize: 15 * scale }]}>{t('continue_without_login', 'Giriş yapmadan devam et')}</Text>
      </TouchableOpacity>
      {notice && <ProfilePhotoFeedback notice={notice} onDismiss={dismissNotice} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1C1E' },
  closeButton: { position: 'absolute', borderRadius: 30, backgroundColor: '#373B42', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  authButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#545454' },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { flex: 1, textAlign: 'center', fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', flexShrink: 1 },
  continueButtonText: { fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
});
