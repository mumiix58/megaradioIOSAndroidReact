import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SplashClothPattern } from './SplashClothPattern';

const assets = {
  background: require('../../assets/images/onboarding/figma/splash-ambient.png'),
  rings: require('../../assets/images/onboarding/figma/splash-rings.png'),
  wordmark: require('../../assets/images/onboarding/figma/splash-wordmark.png'),
};

/** Figma 2:2. The OS launch image and these separately exported layers share geometry. */
export function BrandSplash({ ready = false, hold = false, onReady, onComplete }: {
  ready?: boolean;
  hold?: boolean;
  onReady?: () => void;
  onComplete?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scale = Math.max(width / 375, height / 812);
  const loaded = useRef(new Set<string>());
  const [artworkReady, setArtworkReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const startedAt = useRef(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const onReadyRef = useRef(onReady);
  const onCompleteRef = useRef(onComplete);
  onReadyRef.current = onReady;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const assetLoaded = useCallback((key: string) => {
    loaded.current.add(key);
    if (loaded.current.size === Object.keys(assets).length && !startedAt.current) {
      startedAt.current = Date.now();
      setArtworkReady(true);
      onReadyRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!artworkReady || reduceMotion) { breath.setValue(0); return; }
    // The design specifies Lottie intent but supplies vector layers, not a Lottie file.
    // Keep the wordmark fixed; animate only the original rings subtly on the UI thread.
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [artworkReady, reduceMotion, breath]);


  useEffect(() => {
    if (!artworkReady || !ready || hold) return;
    // Leave as soon as local startup is ready; the motion must not impose a 3s wait.
    Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 300,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
        if (finished) onCompleteRef.current?.();
      });
    return () => opacity.stopAnimation();
  }, [artworkReady, ready, hold, opacity, reduceMotion]);

  return (
    <Animated.View style={[styles.screen, { opacity }]} testID="brand-splash" accessibilityLabel="MegaRadio">
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <View style={[styles.artboard, { left: (width - 375) / 2, top: (height - 812) / 2,
        transform: [{ scale }] }]}>
        <View pointerEvents="none" style={styles.background}>
          <SplashClothPattern enabled={artworkReady && !reduceMotion} />
        </View>
        <Image source={assets.background} style={styles.background} contentFit="fill"
          onLoad={() => assetLoaded('background')} accessible={false} />
        <Animated.View style={[styles.rings, { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]}>
          <Image source={assets.rings} style={StyleSheet.absoluteFill} contentFit="fill"
            onLoad={() => assetLoaded('rings')} accessible={false} />
        </Animated.View>
        <Image source={assets.wordmark} style={styles.wordmark} contentFit="fill"
          onLoad={() => assetLoaded('wordmark')} accessible={false} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1B1C1E', overflow: 'hidden', zIndex: 10000 },
  artboard: { position: 'absolute', width: 375, height: 812, backgroundColor: '#1B1C1E' },
  // Export includes the blur's visual bounds: y131…812, rather than Group 4's layout bounds.
  background: { position: 'absolute', left: 0, top: 131, width: 375, height: 681 },
  rings: { position: 'absolute', left: 62, top: 280, width: 252, height: 252 },
  wordmark: { position: 'absolute', left: 87, top: 374, width: 201.9236, height: 70.0012 },
});
