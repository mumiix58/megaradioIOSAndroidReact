import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

// Figma Car Mode292:960: 150px artwork; shadow0/21.71/81.43/14.11 at30%.
// A separable Gaussian gives a soft color-only shadow on legacy native renderers too.
const HALF = (150 + 14.11 * 2) / 2;
const SIGMA = 81.43 / 2;
const SIZE = HALF * 2 + SIGMA * 6;
function cdf(value: number) {
  const x = Math.abs(value) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return (1 + (value < 0 ? -erf : erf)) / 2;
}
const stops = Array.from({ length: 65 }, (_, i) => {
  const x = SIZE * i / 64 - SIZE / 2;
  return { offset: i / 64, alpha: Math.max(0, cdf((x + HALF) / SIGMA) - cdf((x - HALF) / SIGMA)) };
});

export function LogoShadow({ color, scale, opacity = 0.3, centerX = 188, centerY = 75, testID = 'car-mode-logo-glow' }: { color: string; scale: number; opacity?: number; centerX?: number; centerY?: number; testID?: string }) {
  const id = useId().replace(/:/g, '');
  return <Svg testID={testID} width={SIZE * scale} height={SIZE * scale} viewBox={`0 0 ${SIZE} ${SIZE}`} style={[styles.shadow, { left: (centerX - SIZE / 2) * scale, top: (centerY + 21.71 - SIZE / 2) * scale }]} pointerEvents="none" accessible={false}>
    <Defs>
      <LinearGradient id={`${id}x`} x1={0} y1={0} x2={SIZE} y2={0} gradientUnits="userSpaceOnUse">
        {stops.map(s => <Stop key={s.offset} offset={s.offset} stopColor={color} stopOpacity={s.alpha} />)}
      </LinearGradient>
      <LinearGradient id={`${id}y`} x1={0} y1={0} x2={0} y2={SIZE} gradientUnits="userSpaceOnUse">
        {stops.map(s => <Stop key={s.offset} offset={s.offset} stopColor="#FFFFFF" stopOpacity={s.alpha} />)}
      </LinearGradient>
      <Mask id={`${id}mask`} x={0} y={0} width={SIZE} height={SIZE} maskUnits="userSpaceOnUse">
        <Rect width={SIZE} height={SIZE} fill={`url(#${id}y)`} />
      </Mask>
    </Defs>
    <Rect width={SIZE} height={SIZE} fill={`url(#${id}x)`} mask={`url(#${id}mask)`} opacity={opacity} />
  </Svg>;
}
const styles = StyleSheet.create({ shadow: { position: 'absolute', zIndex: 0 } });
