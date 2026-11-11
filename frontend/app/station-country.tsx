import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { CountrySelectorModal } from '../src/components/CountrySelectorModal';

export default function StationCountryScreen() {
  const router = useRouter();
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);
  return <CountrySelectorModal visible embedded onClose={close} />;
}
