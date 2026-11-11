import React from 'react';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { carouselDelta, carouselGeometry } from '../utils/carCarousel';
import { DiscoveryArtwork } from './DiscoveryArtwork';
import type { Station } from '../types';
import {CountryFlag} from './CountryFlag';

/** Stable card identity; all geometry updates in the same UI-frame worklet. */
export const CarCarouselCard = React.memo(function CarCarouselCard({ station, slot, count, unit, position, phase }: { station?: Station; slot: number; count: number; unit: number; position: SharedValue<number>; phase: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => {
    const card = carouselGeometry(carouselDelta(slot, position.value + phase.value, count));
    const scale = card.size / 150;
    return { transform: [{ translateX: (card.center - 75) * unit }, { scale }], opacity: card.opacity * (1 - Math.min(Math.abs(carouselDelta(slot, position.value + phase.value, count)), 2) * 0.18), zIndex: card.depth, borderRadius: card.radius * unit / scale };
  }, [slot, count, unit]);
  const flagStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(carouselDelta(slot, position.value + phase.value, count)) / 1.25),
  }), [slot, count]);
  const countryCode = (station?.countrycode || station?.countryCode || '').trim().toLowerCase();
  return <Animated.View pointerEvents="none" testID={`car-mode-card-${slot}`} style={[{ position: 'absolute', left: 0, top: 0, width: 150 * unit, height: 150 * unit, overflow: 'visible' }, animated]}>
    <DiscoveryArtwork station={station} unit={unit * 150 / 188} testID={`car-mode-logo-${slot}-${station?._id || 'loading'}`} />
    {/^[a-z]{2}$/.test(countryCode) && <Animated.View testID={`car-mode-country-flag-${slot}`} accessibilityLabel={station?.country || countryCode.toUpperCase()} style={[{ position: 'absolute', bottom: -12 * unit, right: -12 * unit, width: 28 * unit, height: 28 * unit, borderRadius: 14 * unit, overflow: 'hidden', backgroundColor: '#FFFFFF' }, flagStyle]}>
      <CountryFlag code={countryCode} size={28*unit}/>
    </Animated.View>}
  </Animated.View>;
});
