
import React, { useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { MegaMarkIcon } from '../../src/components/BrandIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/theme';
import { MiniPlayer } from '../../src/components/MiniPlayer';
import { usePlayerStore } from '../../src/store/playerStore';
import { useLanguageStore } from '../../src/store/languageStore';

// Tab bar height constant for MiniPlayer positioning
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;

// Original 24 × 24 Figma vectors. Tint follows the navigator's selected state.
const TAB_ICONS = {
  discover: require('../../assets/images/navigation/discover.svg'),
  favorites: require('../../assets/images/mini-player/heart-filled.svg'),
  profile: require('../../assets/images/navigation/profile.svg'),
};
const TabIcon = ({ source, color, name }: { source: ImageSource; color: string; name: string }) => (
  <Image source={source} style={{ width: 24, height: 24 }} tintColor={color}
    contentFit="contain" transition={0} testID={`tab-icon-${name}`} />
);

export default function TabLayout() {
  const { t } = useTranslation();
  const { isMiniPlayerVisible, currentStation } = usePlayerStore();
  const { languageVersion } = useLanguageStore(); // Subscribe to language changes
  const insets = useSafeAreaInsets();
  const showMiniPlayer = isMiniPlayerVisible && currentStation;
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'tabDock', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));

  // Calculate tab bar height with safe area for Android edge-to-edge
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 65 + insets.bottom;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 25 : 8 + insets.bottom;

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={props => <View testID="main-bottom-dock" style={styles.bottomDock}>
          <MiniPlayer docked />
          <View testID="main-tab-bar"><BottomTabBar {...props} /></View>
        </View>}
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            { 
              height: tabBarHeight,
              paddingBottom: tabBarPaddingBottom,
            },
            showMiniPlayer && styles.tabBarWithPlayer,
          ],
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#7E7E7E',
          tabBarLabel: ({ focused, color, children }) => <Text style={[styles.tabBarLabel, { color, fontFamily: focused ? 'Ubuntu-Medium' : 'Ubuntu-Regular' }]}>{children}</Text>,
          tabBarShowLabel: true,
        }}
      >
        {/* Discover - Main/Home tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab_discover', 'Discover'),
            tabBarButtonTestID: 'tab-discover',
            tabBarIcon: ({ color }) => <TabIcon source={TAB_ICONS.discover} color={color} name="discover" />,
          }}
        />
        {/* Genres tab */}
        <Tabs.Screen
          name="genres"
          options={{
            title: t('tab_genres', 'Genres'),
            tabBarHideOnKeyboard: true,
            tabBarButtonTestID: 'tab-genres',
            tabBarIcon: ({ color }) => <MegaMarkIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: t('tab_favorites', 'Favorites'),
            tabBarHideOnKeyboard: true,
            tabBarButtonTestID: 'tab-favorites',
            tabBarIcon: ({ color }) => <TabIcon source={TAB_ICONS.favorites} color={color} name="favorites" />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tab_profile', 'Profile'),
            tabBarButtonTestID: 'tab-profile',
            tabBarIcon: ({ color }) => <TabIcon source={TAB_ICONS.profile} color={color} name="profile" />,
          }}
        />
        {/* Hide records from tab bar */}
        <Tabs.Screen
          name="records"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomDock: { backgroundColor: 'transparent' },
  tabBar: {
    backgroundColor: '#171717',
    borderTopWidth: 0,
    paddingTop: 16,
    paddingHorizontal: 10,
    // Height and paddingBottom set dynamically with safe area insets
  },
  tabBarWithPlayer: {
    // No change needed, MiniPlayer sits above
  },
  tabBarLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Ubuntu-Medium',
    marginTop: 0,
  },
});
