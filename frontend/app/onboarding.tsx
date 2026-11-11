import {useIsFocused} from '@react-navigation/native';
import {useAnalyticsOverlay} from '../src/hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
  Easing} from 'react-native';
import { Image as SvgImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



// Assets
const GIRL_IMAGE = require('../assets/images/onboarding/figma/photo-1.png');
const BOY_SCREEN2_IMAGE = require('../assets/images/onboarding/figma/photo-2.png');
const BOY_SCREEN3_IMAGE = require('../assets/images/onboarding/figma/photo-3.png');

// Preload all onboarding images at module load
const preloadImages = async () => {
  try {
    await Asset.loadAsync([GIRL_IMAGE, BOY_SCREEN2_IMAGE, BOY_SCREEN3_IMAGE]);
    console.log('[Onboarding] All images preloaded');
  } catch (e) {
    console.log('[Onboarding] Image preload error:', e);
  }
};
preloadImages();

// Onboarding data for 3 screens
const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Enjoy',
    subtitle: 'More than 10 thousand radio channels',
    image: GIRL_IMAGE,
    isLast: false,
  },
  {
    id: '2',
    title: 'Anywhere',
    subtitle: 'Listen to the music you want anywhere',
    image: BOY_SCREEN2_IMAGE,
    isLast: false,
  },
  {
    id: '3',
    title: 'Free',
    subtitle: 'MegaRadio is always free',
    image: BOY_SCREEN3_IMAGE,
    isLast: true,
  },
];

const ONBOARDING_COMPLETE_KEY = '@megaradio_onboarding_complete';

// Storage helper for cross-platform support
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
};

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ preview?: string; step?: string }>();
  const flowPreview = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && params.preview === '1';
  const [currentIndex, setCurrentIndex] = useState(() => {
    const step = flowPreview ? Number(params.step) : 1;
    return Number.isInteger(step) && step >= 1 && step <= 3 ? step - 1 : 0;
  });
  const reduceMotion = useReducedMotion();
  const [isChecking, setIsChecking] = useState(true);
 const analyticsFocused=useIsFocused();
  useAnalyticsOverlay('onboarding-'+(currentIndex+1),analyticsFocused&&!isChecking);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitioning = useRef(false);
  const slideX = useRef(new Animated.Value(-currentIndex * 375)).current;
  const arrowX = useRef(new Animated.Value(0)).current;
  const arrowFlight = useRef<Animated.CompositeAnimation | null>(null);
  const nextPending = useRef(false);
  const pressAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const transition = useRef<Animated.CompositeAnimation | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Figma uses a 375×812 full-bleed artboard, including system safe areas.
  const scale = width / 375;
  const layoutHeight = height / scale;
  const compact = Math.min(1, layoutHeight / 812);
  const artboardStyle = { width: 375, height: layoutHeight, left: (width - 375) / 2,
    top: (height - layoutHeight) / 2, transform: [{ scale }] };
  const skipTop = Math.max(59 * compact, (insets.top + 10) / scale);

  
  useEffect(() => {
    if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY !== '1') return;
    const send = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'startup', visible }, 'http://localhost:8082');
    send(true);
    return () => send(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY !== '1') return;
    window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'startupDark', visible: currentIndex !== 1 }, 'http://localhost:8082');
    return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'startupDark', visible: false }, 'http://localhost:8082');
  }, [currentIndex]);
  useEffect(() => () => { transition.current?.stop(); pressAnimation.current?.stop(); arrowFlight.current?.stop(); }, []);

  // Check if onboarding is already complete - redirect if so
  useEffect(() => {
    const checkStatus = async () => {
      if (flowPreview) { setIsChecking(false); return; }
      try {
        const complete = await checkOnboardingComplete();
        console.log('[Onboarding] Checking status:', complete);
        if (complete) {
          console.log('[Onboarding] Already complete, redirecting to home');
          router.replace('/(tabs)');
        } else {
          setIsChecking(false);
        }
      } catch (e) {
        console.error('[Onboarding] Check failed, showing onboarding:', e);
        setIsChecking(false);
      }
    };
    checkStatus();
    // Safety: if check takes too long, show onboarding anyway
    const timeout = setTimeout(() => {
      setIsChecking(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);
  
  const animateToNext = (newIndex: number) => {
    if (transitioning.current) return;
    if (reduceMotion) { slideX.setValue(-newIndex * 375); setCurrentIndex(newIndex); return; }
    transitioning.current = true;
    setIsTransitioning(true);
    setCurrentIndex(newIndex);
    // A single pre-mounted strip prevents image/child replacement flashes.
    transition.current = Animated.timing(slideX, { toValue: -newIndex * 375, duration: 300,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    transition.current.start(() => { transitioning.current = false; setIsTransitioning(false); });
  };

  const pressIn = () => {
    if (transitioning.current || nextPending.current) return;
    pressAnimation.current?.stop();
    if (!reduceMotion) {
      // Only the arrow anticipates the gesture; the pink circle stays fixed.
      pressAnimation.current = Animated.timing(arrowX, { toValue: -3, duration: 75,
        easing: Easing.out(Easing.quad), useNativeDriver: true });
      pressAnimation.current.start();
    }
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const pressOut = () => {
    if (nextPending.current) return;
    pressAnimation.current?.stop();
    pressAnimation.current = Animated.timing(arrowX, { toValue: 0, duration: reduceMotion ? 0 : 100,
      easing: Easing.out(Easing.quad), useNativeDriver: true });
    pressAnimation.current.start();
  };

  const handleNext = async () => {
    if (transitioning.current || nextPending.current) return;
    if (currentIndex === ONBOARDING_DATA.length - 1) { await completeOnboarding(); return; }
    if (reduceMotion) { animateToNext(currentIndex + 1); return; }
    nextPending.current = true;
    setIsTransitioning(true);
    pressAnimation.current?.stop();
    arrowFlight.current = Animated.timing(arrowX, { toValue: 44, duration: 110,
      easing: Easing.in(Easing.quad), useNativeDriver: true });
    arrowFlight.current.start(({ finished }) => {
      if (!finished) return;
      arrowX.setValue(-30);
      animateToNext(currentIndex + 1);
      arrowFlight.current = Animated.timing(arrowX, { toValue: 0, duration: 220,
        easing: Easing.out(Easing.cubic), useNativeDriver: true });
      arrowFlight.current.start();
      nextPending.current = false;
    });
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    if (flowPreview) { router.replace('/auth-options'); return; }
    try {
      await storage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
    router.replace('/(tabs)');
  };

  // Don't render anything while checking onboarding status
  if (isChecking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FF4199" />
      </View>
    );
  }

  const renderPage = (index: number) => {
    const item = ONBOARDING_DATA[index];
    const active = index === currentIndex;
    return <View style={styles.page} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'} aria-hidden={!active} pointerEvents={active ? 'auto' : 'none'}>
        <Image source={item.image}
          style={[styles.backgroundImage, { height: index === 0 ? 752 : 812 }]}
          resizeMode="stretch" accessible={false} />
        <LinearGradient pointerEvents="none"
          colors={['rgba(0,0,0,0)', '#000000']}
          locations={[0, 0.2942]} style={[styles.gradientOverlay, { top: 348 * compact, height: layoutHeight - 348 * compact }]} />
        <TouchableOpacity style={[styles.skipButton, { top: skipTop }]}
          onPress={handleSkip} disabled={!active || isTransitioning} activeOpacity={0.7} accessibilityRole="button"
          accessibilityLabel="Skip onboarding" testID={active ? "onboarding-skip-btn" : undefined}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title, { top: 496 * compact }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { top: 557 * compact }]}>{item.subtitle}</Text>
        <View style={[styles.dotsContainer, { top: 604 * compact }]} accessibilityLabel={`Page ${index + 1} of 3`}>
          {ONBOARDING_DATA.map((item, i) => (
            <View key={item.id} style={i === index ? styles.dotActive : styles.dotInactive} />
          ))}
        </View>
        <View style={[styles.buttonWrapper, { top: 680 * compact }]}>
          <View pointerEvents="none" style={styles.buttonGlow} />
          {item.isLast ? (
            <TouchableOpacity style={styles.getStartedButton} onPress={handleNext} disabled={!active || isTransitioning}
              onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} accessibilityRole="button" testID={active ? "onboarding-getstarted-btn" : undefined}>
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext} disabled={!active || isTransitioning}
              onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Next"
              testID={active ? "onboarding-next-btn" : undefined}>
              <Animated.View pointerEvents="none" testID={active ? 'onboarding-next-arrow' : undefined}
                style={{ transform: [{ translateX: arrowX }], opacity: arrowX.interpolate({
                  inputRange: [-40, -30, 0, 28, 44], outputRange: [0, 0, 1, 0, 0], extrapolate: 'clamp' }) }}>
                <SvgImage source={require('../assets/images/onboarding/figma/next-arrow.svg')}
                  style={styles.nextArrow} contentFit="contain" accessible={false} />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>
    </View>;
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      <StatusBar style={currentIndex === 1 ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <View style={[styles.artboard, artboardStyle]}>
        <Animated.View style={{ width: 375 * ONBOARDING_DATA.length, height: layoutHeight,
          flexDirection: 'row', transform: [{ translateX: slideX }] }}>
          {ONBOARDING_DATA.map((item, index) => <View key={item.id}
            style={{ width: 375, height: layoutHeight }} pointerEvents={index === currentIndex ? 'auto' : 'none'}
            accessibilityElementsHidden={index !== currentIndex}
            importantForAccessibility={index === currentIndex ? 'auto' : 'no-hide-descendants'}
            aria-hidden={index !== currentIndex}>
            {renderPage(index)}
          </View>)}
        </Animated.View>
      </View>
    </View>
  );
}

// Check if onboarding has been completed
export const checkOnboardingComplete = async (): Promise<boolean> => {
  try {
    const value = await storage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error reading onboarding status:', error);
    return false;
  }
};

// Reset onboarding (for testing)
export const resetOnboarding = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    } else {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    }
  } catch (error) {
    console.error('Error resetting onboarding:', error);
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  artboard: { position: 'absolute', backgroundColor: '#000000', overflow: 'hidden' },
  page: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  backgroundImage: { position: 'absolute', top: 0, left: 0, width: 375 },
  gradientOverlay: { position: 'absolute', top: 348, left: 0, width: 375, height: 464 },
  skipButton: { position: 'absolute', left: 286, width: 59, height: 35,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', fontSize: 15, lineHeight: 17 },
  title: { position: 'absolute', top: 496, left: 0, width: 375, height: 43,
    fontFamily: 'Ubuntu-Bold', fontSize: 36, lineHeight: 43, color: '#FF4199', textAlign: 'center', includeFontPadding: false },
  subtitle: { position: 'absolute', top: 557, left: 20, width: 335,
    fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, color: '#FFFFFF', textAlign: 'center', includeFontPadding: false },
  dotsContainer: { position: 'absolute', top: 604, left: 167, height: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5 },
  dotActive: { width: 19, height: 6, borderRadius: 20, backgroundColor: '#FF4199' },
  dotInactive: { width: 6, height: 6, borderRadius: 20, backgroundColor: '#4A4A4A' },
  buttonWrapper: { position: 'absolute', top: 680, left: 0, width: 375, height: 58,
    alignItems: 'center', justifyContent: 'center' },
  buttonGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 30,
    backgroundColor: '#FF4199', shadowColor: '#FF4199', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 25, elevation: 0 },
  nextButton: { width: 58, height: 58, borderRadius: 30, backgroundColor: '#FF4199', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  nextArrow: { width: 34, height: 34 },
  getStartedButton: { width: 196, height: 58, borderRadius: 30, backgroundColor: '#FF4199',
    alignItems: 'center', justifyContent: 'center' },
  getStartedText: { fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', fontSize: 15, lineHeight: 17 },
});
