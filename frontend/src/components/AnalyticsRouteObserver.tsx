import { useEffect, useRef } from 'react';
import { useRootNavigationState, useSegments } from 'expo-router';
import analyticsService from '../services/analyticsService';
import { analyticsScreen } from '../utils/analyticsMetrics';

export function AnalyticsRouteObserver() {
  const segments = useSegments();
  const navigation = useRootNavigationState();
  const previous = useRef<string | null>(null);
  const screen = analyticsScreen(segments);
  useEffect(() => {
    if (!navigation?.key || previous.current === screen) return;
    previous.current = screen;
    void analyticsService.logScreenView(screen, 'app_route');
  }, [navigation?.key, screen]);
  return null;
}
