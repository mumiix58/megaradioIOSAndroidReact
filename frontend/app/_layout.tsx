// LOGGING: Import at very top

// Cold start timing anchor: JS bundle execution start
const JS_START_TIME = Date.now();

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { queryClient } from '../src/services/queryClient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, Platform, AppState, AppStateStatus, Text, InteractionManager } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nextProvider } from 'react-i18next';

// Prevent splash screen from auto-hiding (we control when it hides)
SplashScreen.preventAutoHideAsync().catch(() => {});

import i18n, { initI18n } from '../src/services/i18nService';
import { colors } from '../src/constants/theme';
import { RadioErrorModal } from '../src/components/RadioErrorModal';
import { preloadEssentialData, preloadStationData } from '../src/services/preloadService';
import { initializeApp as initializeTvData } from '../src/services/tvInitService';
import { useLocationStore } from '../src/store/locationStore';
import { useLanguageStore } from '../src/store/languageStore';
import { useFavoritesStore } from '../src/store/favoritesStore';
import { useAuthStore } from '../src/store/authStore';
import { adMobService } from '../src/services/adMobService';
import { usePremiumStore } from '../src/store/premiumStore';
import { rateUsService } from '../src/services/rateUsService';
import { RateUsModal } from '../src/components/RateUsModal';

import { AudioProvider } from '../src/providers/AudioProvider';

// Root Error Boundary — catches ANY crash and shows fallback UI instead of blank screen
// Critical for iPad where initialization can fail silently
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[RootErrorBoundary] App crash caught:', error.message);
    try { crashlyticsService.recordError(error, 'RootErrorBoundary'); } catch (e) {}
    // Force hide splash so user sees something
    try { SplashScreen.hideAsync(); } catch (e) {}
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0D0F', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>MegaRadio</Text>
          <Text style={{ color: '#999', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            Something went wrong. Please restart the app.
          </Text>
          <Text style={{ color: '#666', fontSize: 11 }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// The root boundary owns failures for the whole audio subtree. Rendering its
// consumers without AudioProvider would throw again and hide the original error.
import { MiniPlayer } from '../src/components/MiniPlayer';
import { usePlayerStore } from '../src/store/playerStore';
import { PlayAtLoginHandler } from '../src/components/PlayAtLoginHandler';
import { QuickActionsHandler } from '../src/components/QuickActionsHandler';
import { NotificationHandler } from '../src/components/NotificationHandler';
// FlowAlive DISABLED - NPM package has bug (yalc reference in dependencies)
// import { FlowAliveProvider } from 'flowalive-analytics/expo';
import { flowaliveService } from '../src/services/flowaliveService';
import analyticsService from '../src/services/analyticsService';
import { AnalyticsRouteObserver } from '../src/components/AnalyticsRouteObserver';
import crashlyticsService from '../src/services/crashlyticsService';

// CarPlay - Re-enabled after fixing native delegate issues
import { CarPlayHandler } from '../src/components/CarPlayHandler';


const ONBOARDING_COMPLETE_KEY = '@megaradio_onboarding_complete';
// FlowAlive DISABLED - NPM package bug
// const FLOWALIVE_API_KEY = 'flowalive_b42f8188aad215f2250e5f0889adcbf4';


// Storage helper for cross-platform support
const checkOnboardingComplete = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      const value = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
      return value === 'true';
    }
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding:', error);
    return false;
  }
};


// Global MiniPlayer wrapper - MOVED INSIDE to avoid module-level hook issues
const GlobalMiniPlayer = React.memo(() => {
  const segments = useSegments();
  const { isMiniPlayerVisible } = usePlayerStore();
  
  // Don't show on tabs (they have their own MiniPlayer), player screen, or auth screens
  const isTabScreen = segments[0] === '(tabs)';
  const isPlayerScreen = segments.includes('player');
  const isAuthScreen = ['login', 'signup', 'auth-options', 'onboarding'].includes(segments[0] as string);
  
  if (isTabScreen || isPlayerScreen || isAuthScreen || !isMiniPlayerVisible) {
    return null;
  }
  
  // For non-tab screens, show MiniPlayer at the bottom with safe area padding
  return <MiniPlayer isGlobal={true} />;
});

export default function RootLayout() {
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const startupReportedRef = useRef(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);
  const preloadStarted = useRef(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [showRateUs, setShowRateUs] = useState(false);
  const subscriptionAccount = useAuthStore(state => state.token);

  // Account entitlement does not depend on StoreKit product loading.
  useEffect(() => {
    if (!subscriptionAccount) return;
    void import('../src/services/iapService').then(({ iapService }) => iapService.syncSubscriptionFromBackend()).catch(() => {});
  }, [subscriptionAccount]);
  
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Log on first render
  useEffect(() => {

    // Configure Google Sign-In native SDK (call once at app start)
    if (Platform.OS !== 'web') {
      try {
        const { socialAuthService } = require('../src/services/socialAuthService');
        socialAuthService.configureGoogle();
      } catch (e) {
        console.warn('[Layout] Google Sign-In configure error:', e);
      }
    }

    // Request the native review UI only after an eligible listening session.
    rateUsService.trackAppLaunch().catch(() => {});
    const unsubscribe = rateUsService.onShouldShow(() => {
      setShowRateUs(true);
    });

    // Siri voice intent deep-link handler.
    // AppDelegate's `application(_:continue:restorationHandler:)` converts
    // INPlayMediaIntent → `megaradio://play?q=<station>` and dispatches it
    // through the same Linking pipeline a regular tap on a deep link uses.
    // We catch the URL here, extract the query, and forward to the search
    // screen which already handles "play first matching station" behaviour.
    let siriSub: { remove: () => void } | null = null;
    try {
      // Lazy-require so non-iOS platforms / tests don't crash.
      const RN = require('react-native');
      const handleSiriUrl = (url: string | { url: string } | null) => {
        if (!url) return;
        const raw = typeof url === 'string' ? url : url.url;
        if (!raw || raw.indexOf('megaradio://play') !== 0) return;
        try {
          const q = decodeURIComponent((raw.split('?q=')[1] || '').split('&')[0] || '');
          if (!q) return;
          console.log('[Siri] play intent received:', q);
          // Navigate to search with the query pre-filled and autoplay on.
          router.push({
            pathname: '/(tabs)/search' as any,
            params: { q, autoplay: '1' },
          } as any);
        } catch (e) {
          console.warn('[Siri] failed to parse intent URL:', e);
        }
      };
      siriSub = RN.Linking.addEventListener('url', (ev: any) => handleSiriUrl(ev?.url));
      RN.Linking.getInitialURL().then(handleSiriUrl).catch(() => {});
    } catch (e) {
      console.warn('[Siri] Linking listener setup failed (non-fatal):', e);
    }

    return () => {
      unsubscribe();
      if (siriSub && typeof siriSub.remove === 'function') siriSub.remove();
    };
  }, []);

  // Initialize FlowAlive Analytics
  useEffect(() => {
    const initFlowalive = async () => {
      try {
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
        await Promise.race([flowaliveService.initDevice(), timeout]);
        console.log('[Layout] FlowAlive Analytics initialized');
      } catch (error) {
        console.error('[Layout] FlowAlive initialization error:', error);
      }
    };
    initFlowalive();
  }, []);

  // Initialize Firebase Analytics (GA4)
  useEffect(() => {
    const initAnalytics = async () => {
      try {
        void require('../src/services/firebaseRuntimeService').initializeFirebaseRuntime();
        await analyticsService.initialize();
        await analyticsService.logAppOpen();
        console.log('[Layout] Firebase Analytics initialized');
      } catch (error) {
        console.warn('[Layout] Firebase Analytics init error:', error);
      }
    };
    initAnalytics();

    // Launch source baseline: if no fast-access path (quick action / Siri /
    // Assistant) reported within the startup window, count it as 'normal'
    const launchTimer = setTimeout(() => {
      try {
        const { reportLaunchSource } = require('../src/services/launchSourceService');
        reportLaunchSource('normal');
      } catch (e) {}
    }, 6000);
    return () => clearTimeout(launchTimer);
  }, []);

  // Initialize Firebase Crashlytics
  useEffect(() => {
    const initCrashlytics = async () => {
      try {
        await crashlyticsService.initialize();
        crashlyticsService.setupGlobalErrorHandler();
        crashlyticsService.log('App started');
        const build = Platform.OS === 'android'
          ? Constants.nativeBuildVersion || Constants.expoConfig?.android?.versionCode
          : Constants.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber;
        crashlyticsService.setAttribute('app_version_code', String(build ?? 'unknown'));
        console.log('[Layout] Firebase Crashlytics initialized');
      } catch (error) {
        console.warn('[Layout] Firebase Crashlytics init error:', error);
      }
    };
    initCrashlytics();
  }, []);

  // Load stored authentication on app startup
  useEffect(() => {
    const loadAuth = async () => {
      console.log('[Layout] Loading stored authentication...');
      try {
        await useAuthStore.getState().loadStoredAuth();
        const { isAuthenticated } = useAuthStore.getState();
        console.log('[Layout] Auth loaded, isAuthenticated:', isAuthenticated);
        
        // If authenticated, immediately load favorites from server to avoid "no favorites" flash
        if (isAuthenticated) {
          console.log('[Layout] User authenticated, loading favorites immediately...');
          // Set analytics & crashlytics user properties
          const authState = useAuthStore.getState();
          if (authState.user?.id) {
            crashlyticsService.setUserId(authState.user.id);
          }
          try {
            await useFavoritesStore.getState().loadFavorites();
            console.log('[Layout] Favorites loaded:', useFavoritesStore.getState().favorites.length);
          } catch (favError) {
            console.error('[Layout] Failed to load favorites:', favError);
          }
        }
      } catch (error) {
        console.error('[Layout] Failed to load stored auth:', error);
      }
    };
    loadAuth();
  }, []);

  // Load premium status on app startup (fast, AsyncStorage only)
  // IAP/StoreKit init is DEFERRED — it was competing with launch and blocking
  // the native module queue for 15s+ on cold start
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Defer IAP init until UI is interactive (4s after mount + interactions done)
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const { iapService } = require('../src/services/iapService');
          const result = await iapService.initialize();
          console.log('[Layout] IAP initialized (deferred):', result);

        } catch (iapError) {
          console.log('[Layout] IAP deferred init error (expected on simulator):', iapError);
        }
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Load stored country selection on app startup - WAIT FOR IT
  const [countryLoaded, setCountryLoaded] = useState(false);
  
  useEffect(() => {
    const loadCountry = async () => {
      console.log('[Layout] Loading stored country selection...');
      try {
        await useLocationStore.getState().loadStoredCountry();
        const state = useLocationStore.getState();
        console.log('[Layout] Country loaded:', state.country, 'isManuallySet:', state.isManuallySet);

        // GPS detection runs fully in BACKGROUND — it must never hold the splash
        // screen (it used to block it for up to 5s on every cold start)
        if (!state.isManuallySet) {
          console.log('[Layout] Country not manually set, starting background GPS detection...');
          useLocationStore.getState().fetchLocation()
            .then(() => {
              const newState = useLocationStore.getState();
              console.log('[Layout] GPS detection result:', newState.country, newState.countryCode);
            })
            .catch(() => {});
        } else {
          console.log('[Layout] Country manually set by user, skipping GPS detection');
        }
      } catch (error) {
        console.error('[Layout] Failed to load stored country:', error);
      } finally {
        // Splash is unblocked as soon as the stored country is read (fast)
        setCountryLoaded(true);
      }
    };
    loadCountry();
  }, []);

  // Load icon fonts by requiring TTF files directly + custom fonts
  const [fontsLoaded, fontError] = useFonts({
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
    'FontAwesome5_Brands': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.ttf'),
    'FontAwesome5_Regular': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf'),
    'FontAwesome5_Solid': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf'),
    'Ubuntu-Regular': require('../assets/fonts/Ubuntu-Regular.ttf'),
    'Ubuntu-Medium': require('../assets/fonts/Ubuntu-Medium.ttf'),
    'Ubuntu-Bold': require('../assets/fonts/Ubuntu-Bold.ttf'),
    'Ubuntu-BoldItalic': require('../assets/fonts/Ubuntu-BoldItalic.ttf'),
  });

  // Initialize i18n
  useEffect(() => {
    const init = async () => {
      try {
        await initI18n();
        setI18nReady(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        setI18nReady(true); // Continue anyway
      }
    };
    init();
  }, []);

  // Initialize AdMob - MUST wait for splash to hide AND app to be truly active
  // iOS requires the app to be fully visible for ATT prompt to appear
  // If called during splash screen or before applicationDidBecomeActive, iOS silently ignores ATT
  useEffect(() => {
    if (!splashHidden) return; // Wait for splash to hide first
    
    let cancelled = false;
    
    const initAds = async () => {
      // Wait for app to be truly active using AppState
      // This ensures applicationDidBecomeActive has been called
      const waitForActiveState = (): Promise<void> => {
        return new Promise((resolve) => {
          if (AppState.currentState === 'active') {
            resolve();
            return;
          }
          const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
              subscription.remove();
              resolve();
            }
          });
          // Timeout after 10s even if we don't get active state
          setTimeout(() => {
            subscription.remove();
            resolve();
          }, 10000);
        });
      };
      
      await waitForActiveState();
      if (cancelled) return;
      
      // Extra delay to ensure UI is fully rendered and interactive (iOS needs this)
      await new Promise(r => setTimeout(r, 2500));
      if (cancelled) return;
      
      try {
        console.log('[Layout] Initializing AdMob (AppState:', AppState.currentState, ')');
        
        // Add timeout to prevent AdMob from blocking
        const adMobTimeout = new Promise<boolean>((resolve) =>
          setTimeout(() => {
            console.warn('[Layout] AdMob init timed out after 20s');
            resolve(false);
          }, 20000)
        );
        const success = await Promise.race([adMobService.initialize(), adMobTimeout]);
        console.log('[Layout] AdMob initialized:', success);
        
        if (success && !cancelled) {
          // App Open ad will be triggered by AudioProvider on first station play
          // Do NOT show ad here - it would consume Interstitial/Rewarded fallbacks
          // before the user even interacts with the app
          console.log('[Layout] AdMob ready, ads will show on user interaction');
        } else if (!cancelled) {
          // Retry once after 10s if first attempt failed
          console.log('[Layout] AdMob init failed, retrying in 10s...');
          setTimeout(async () => {
            if (cancelled) return;
            try {
              const retrySuccess = await adMobService.initialize();
              console.log('[Layout] AdMob retry result:', retrySuccess);
            } catch (retryError) {
              console.error('[Layout] AdMob retry error:', retryError);
            }
          }, 10000);
        }
      } catch (error) {
        console.error('[Layout] AdMob initialization error:', error);
      }
    };
    initAds();
    
    return () => { cancelled = true; };
  }, [splashHidden]);

  // Preload TV/Mobile init data - Works for BOTH TV and mobile platforms
  // This fetches all essential startup data in one API call
  const [appDataReady, setAppDataReady] = useState(false);
  
  useEffect(() => {
    const initAppData = async () => {
      if (preloadStarted.current) return;
      preloadStarted.current = true;
      
      try {
        console.log('[Layout] Initializing app data with /api/tv/init...');
        
        // Wait for country to be loaded first
        const locationState = useLocationStore.getState();
        const country = locationState.countryEnglish || locationState.country;
        const countryCode = locationState.countryCode;
        
        console.log('[Layout] Using country:', country, 'code:', countryCode);
        
        // Initialize app data (translations only - no caching)
        const data = await initializeTvData(country);
        
        if (data) {
          console.log('[Layout] App data initialized:', {
            popularStations: data.popularStations?.length || 0,
            genres: data.genres?.length || 0,
            countries: data.countries?.length || 0,
          });
        }
        
        setAppDataReady(true);
        
        // Background pre-fetch station data to disk cache
        if (country) {
          preloadStationData(country).catch(() => {});
        }
      } catch (error) {
        console.error('[Layout] App data init error:', error);
        setAppDataReady(true); // Continue anyway
      }
    };
    
    // Only run after country is loaded
    if (countryLoaded) {
      initAppData();
    }
  }, [countryLoaded]);

  // App state listener for background/foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        focusManager.setFocused(true);
        void useAuthStore.getState().revalidateSession();
        void import('../src/services/authRevocationService').then(service => service.revokeSession()).catch(() => {});
        void import('../src/services/iapService').then(service => service.iapService.syncSubscriptionFromBackend()).catch(() => {});
      } else if (nextAppState === 'background') {
        focusManager.setFocused(false);
      }
    };

    // This runs when the component unmounts - remove the listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Check if navigation is ready
  useEffect(() => {
    if (navigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key]);

  // Handle routing based on onboarding status (after navigation is ready)
  useEffect(() => {
    const checkAndRoute = async () => {
      if (!isNavigationReady || hasCheckedOnboarding) return;
      
      try {
        const onboardingComplete = await checkOnboardingComplete();
        setHasCheckedOnboarding(true);

        // Wait briefly (max 1s) for the disk cache memory layer to hydrate so
        // home-screen queries get instant initialData — never blocks beyond the cap
        try {
          const { diskCache } = require('../src/services/diskCacheService');
          await Promise.race([
            diskCache.whenReady(),
            new Promise<void>((r) => setTimeout(r, 1000)),
          ]);
        } catch (e) {}
        
        // Don't redirect if user is navigating to a specific route
        if (segments.length > 0 && !['(tabs)', 'onboarding'].includes(segments[0] as string)) {
          return;
        }
        
        if (onboardingComplete) {
          console.log('[Layout] Onboarding complete, going to home...');
          router.replace('/(tabs)');
        } else {
          console.log('[Layout] Going to onboarding...');
          router.replace('/onboarding');
        }
        
        // Initialize language store (this will load stored/device language)
        await useLanguageStore.getState().initialize();
      } catch (error) {
        console.error('Error during routing:', error);
        setHasCheckedOnboarding(true);
        router.replace('/onboarding');
      }
    };

    checkAndRoute();
  }, [isNavigationReady, hasCheckedOnboarding, segments]);

  // Safety timeout: Force hide splash after 15 seconds no matter what
  // This prevents blank screen on iPad if country/font loading takes too long
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!splashHidden) {
        console.log('[Layout] SAFETY: Force hiding splash after 15s timeout');
        SplashScreen.hideAsync().catch(() => {});
        setSplashHidden(true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Mark splash as hidden once fonts are loaded and app data is ready
  // This triggers AdMob/ATT initialization (must happen AFTER splash hides on iOS)
  useEffect(() => {
    if ((fontsLoaded || fontError) && countryLoaded && !splashHidden) {
      console.log('[Layout] App ready - hiding splash screen');
      SplashScreen.hideAsync().catch((e) => console.log('[Layout] SplashScreen.hide error:', e));
      setSplashHidden(true);
    }
  }, [fontsLoaded, fontError, countryLoaded, splashHidden]);

  // Report cold start duration (JS start → splash hidden) once, deferred 8s
  useEffect(() => {
    if (!splashHidden || startupReportedRef.current) return;
    startupReportedRef.current = true;
    const startupMs = Date.now() - JS_START_TIME;
    console.log('[Layout] Startup time (JS start → splash hidden):', startupMs, 'ms');
    const t = setTimeout(() => {
      analyticsService.logStartupTime?.(startupMs)?.catch?.(() => {});
    }, 8000);
    return () => clearTimeout(t);
  }, [splashHidden]);

  const onLayoutRootView = useCallback(async () => {
    // Fonts loaded - app is ready
    if (fontsLoaded || fontError) {
      console.log('[Layout] Fonts loaded, app ready');
    }
  }, [fontsLoaded, fontError]);

  return (
    <RootErrorBoundary>
    <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
      <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <AudioProvider>
              <PlayAtLoginHandler />
              <QuickActionsHandler />
              <NotificationHandler />
              {/* CarPlay - Re-enabled after native delegate fixes */}
              <CarPlayHandler />
              <View style={styles.container}>
                <StatusBar style="light" />
                <AnalyticsRouteObserver />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen
                    name="player"
                    options={{
                      presentation: 'fullScreenModal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen name="search" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="signup" options={{ headerShown: false }} />
                  <Stack.Screen name="statistics" options={{ headerShown: false }} />
                  <Stack.Screen name="play-at-login" options={{ headerShown: false }} />
                  <Stack.Screen name="followers" options={{ headerShown: false }} />
                  <Stack.Screen name="follows" options={{ headerShown: false }} />
                  <Stack.Screen name="user-profile" options={{ headerShown: false }} />
                  <Stack.Screen name="open-link" options={{ headerShown: false }} />
                  <Stack.Screen name="link-error" options={{ headerShown: false }} />
                  <Stack.Screen name="languages" options={{ headerShown: false }} />
                  <Stack.Screen name="auth-options" options={{ headerShown: false }} />
                  <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
                  <Stack.Screen name="genres" options={{ headerShown: false }} />
                  <Stack.Screen name="genre-detail" options={{ headerShown: false }} />
                  <Stack.Screen name="all-stations" options={{ headerShown: false }} />
                  <Stack.Screen name="notifications" options={{ headerShown: false }} />
                  <Stack.Screen name="users" options={{ headerShown: false }} />
                  <Stack.Screen name="public-profiles" options={{ headerShown: false }} />
                </Stack>
                {/* Global MiniPlayer - shown on all screens except player */}
                <GlobalMiniPlayer />
                <RadioErrorModal />
                {/* Stores own the review UI; this component renders no pre-prompt. */}
                <RateUsModal
                  visible={showRateUs}
                  onClose={() => {
                    setShowRateUs(false);
                  }}
                />
              </View>
            </AudioProvider>
          </QueryClientProvider>
        </I18nextProvider>
    </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
