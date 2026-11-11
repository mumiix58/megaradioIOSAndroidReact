import React, { useEffect } from 'react';
import { View } from 'react-native';
import Reanimated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/** Figma equ1:3975: 19×20, three 5px bars with 2px gaps, resting heights20/14/17. */
function Bar({ playing, rest, low, high, duration, index, color, scale }: { scale: number; color: string; playing: boolean; rest: number; low: number; high: number; duration: number; index: number }) {
  const height = useSharedValue(rest);
  const reduced = useReducedMotion();
  useEffect(() => {
    cancelAnimation(height);
    if (playing && !reduced) {
      height.value = withRepeat(withSequence(
        withTiming(low, { duration }),
        withTiming(high, { duration: duration * 0.8 }),
      ), -1, false);
    } else height.value = rest;
    return () => cancelAnimation(height);
  }, [playing, reduced, rest, low, high, duration, height]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Reanimated.View testID={`player-equalizer-bar-${index}`} style={[{ width: 5 * scale, borderRadius: 10 * scale, backgroundColor: color }, style]} />;
}

export const PlayerEqualizer = React.memo(function PlayerEqualizer({ playing, color = '#FF4199', scale = 1 }: { playing: boolean; color?: string; scale?: number }) {
  return <View testID="player-equalizer" accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ width: 19 * scale, height: 20 * scale, marginBottom: 6 * scale, flexDirection: 'row', alignItems: 'flex-end', gap: 2 * scale }}>
    <Bar scale={scale} color={color} playing={playing} rest={20 * scale} low={5 * scale} high={20 * scale} duration={400} index={0} />
    <Bar scale={scale} color={color} playing={playing} rest={14 * scale} low={7 * scale} high={20 * scale} duration={350} index={1} />
    <Bar scale={scale} color={color} playing={playing} rest={17 * scale} low={5 * scale} high={17 * scale} duration={450} index={2} />
  </View>;
});
