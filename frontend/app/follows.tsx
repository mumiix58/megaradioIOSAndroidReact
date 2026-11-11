import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
export default function ConnectionsRoute() {
  const { previewConnections } = useLocalSearchParams<{ previewConnections?: string }>();
  return <Redirect href={{ pathname: '/(tabs)/profile', params: { connections: 'following', ...(__DEV__ && previewConnections === '1' ? { previewConnections: '1' } : {}) } }} />;
}
