import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StaticPageContent } from '../src/components/StaticPageContent';

export default function StaticPageScreen() {
  const router = useRouter();
  const { type = 'about' } = useLocalSearchParams<{ type: 'about' | 'terms' | 'privacy' }>();
  return <StaticPageContent type={type} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />;
}
