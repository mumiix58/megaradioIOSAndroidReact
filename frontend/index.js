// App entry point
// IMPORTANT: Import gesture handler FIRST - required for React Navigation
import 'react-native-gesture-handler';

import { Platform } from 'react-native';
import 'expo-router/entry';

// Register the playback service for background audio (native only)
if (Platform.OS !== 'web') {
  try {
    const TrackPlayer = require('react-native-track-player').default;
    TrackPlayer.registerPlaybackService(() => require('./service'));
    console.log('[App] Track Player service registered for', Platform.OS);
  } catch (error) {
    console.error('[App] Failed to register Track Player:', error);
  }
} else {
  console.log('[App] Web platform - Track Player not available');
}
