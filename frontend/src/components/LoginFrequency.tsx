import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const MARK = require('../../assets/images/auth/figma/login-mark.svg');
// Original geometry/gradients: Figma 1785:5867. Motion is an approved adaptation,
// not an animation track supplied by the designer. The brand mark never moves.
const ARCS = [
  { radius: 93.5, top: 67, bottom: 145.21, opacity: 0.45 },
  { radius: 125.5, top: 35, bottom: 139.28, opacity: 0.6 },
  { radius: 160.5, top: 0, bottom: 132.794, opacity: 0.95 },
];

export function LoginFrequency({ size = 326 }: { size?: number }) {
  const phases = useRef(ARCS.map(() => new Animated.Value(0))).current;
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    phases.forEach(phase => phase.setValue(0));
    if (!focused || !active || reduceMotion) return;
    const animations = phases.map((phase, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 180),
      Animated.timing(phase, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(phase, { toValue: 0, duration: 1650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(700 - index * 180),
    ])));
    animations.forEach(animation => animation.start());
    return () => { animations.forEach(animation => animation.stop()); phases.forEach(phase => phase.setValue(0)); };
  }, [focused, active, reduceMotion, phases]);

  return (
    <View pointerEvents="none" accessible={false} testID="login-frequency" style={{ width: size, height: size }}>
      {ARCS.map((arc, index) => (
        <Animated.View key={index} testID={`login-frequency-arc-${index}`} style={[StyleSheet.absoluteFill, {
          opacity: phases[index].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
          transform: [{ scale: phases[index].interpolate({ inputRange: [0, 1], outputRange: [1, 1.024] }) }],
        }]}>
          <Svg width={size} height={size} viewBox="0 0 326 326">
            <Defs><LinearGradient id={`frequency-${index}`} x1="163" y1={arc.top} x2="163" y2={arc.bottom} gradientUnits="userSpaceOnUse">
              <Stop stopColor="#FF4199" stopOpacity={0.16} />
              <Stop offset="1" stopColor="#FF4199" stopOpacity={0} />
            </LinearGradient></Defs>
            <Circle cx={163} cy={163} r={arc.radius} strokeWidth={5} fill="none" stroke={`url(#frequency-${index})`} strokeOpacity={arc.opacity} />
          </Svg>
        </Animated.View>
      ))}
      <Image source={MARK} contentFit="contain" style={{ position: 'absolute', left: size * 137 / 326,
        top: size * 107 / 326, width: size * 51 / 326, height: size * 50 / 326 }} />
    </View>
  );
}
