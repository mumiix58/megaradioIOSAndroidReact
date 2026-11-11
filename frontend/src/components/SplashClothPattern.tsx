import React, { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation, createAnimatedPropAdapter, Easing, SharedValue,
  useAnimatedProps, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import dots from '../constants/splashPatternDots.json';
import { splashClothOffset, splashClothWeight } from '../utils/splashCloth';

const IS_WEB = Platform.OS === 'web';
const AnimatedGroup = Animated.createAnimatedComponent(G);
// react-native-svg's native Group accepts a six-value affine matrix directly.
const matrixAdapter = createAnimatedPropAdapter(() => { 'worklet'; }, ['matrix']);

const ClothDot = memo(function ClothDot({ dot, index, phase, amount }: {
  dot: { d: string; x: number; y: number };
  index: number;
  phase: SharedValue<number>;
  amount: SharedValue<number>;
}) {
  const weight = splashClothWeight(dot.x, dot.y);
  const localPhase = (dot.x / 470 - (681 - dot.y) / 760) * Math.PI * 2;
  const animatedProps = useAnimatedProps<{ transform?: string; matrix?: number[] }>(() => {
    const [x, y] = splashClothOffset(weight, localPhase, phase.value, amount.value);
    return IS_WEB
      ? { transform: `translate(${x} ${y})` }
      : { matrix: [1, 0, 0, 1, x, y] };
  }, [weight, localPhase], matrixAdapter);
  return <AnimatedGroup animatedProps={animatedProps} testID={`splash-cloth-dot-${index}`}>
    <Path d={dot.d} fill="#FF4199" />
  </AnimatedGroup>;
});

/** Original Figma vector paths and clips, deformed individually like a softly held fabric. */
export function SplashClothPattern({ enabled }: { enabled: boolean }) {
  const phase = useSharedValue(0);
  const amount = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(amount);
    phase.value = 0;
    amount.value = 0;
    if (enabled) {
      amount.value = withTiming(1, { duration: 480, easing: Easing.inOut(Easing.sin) });
      phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }), -1, false);
    }
    return () => { cancelAnimation(phase); cancelAnimation(amount); };
  }, [enabled, phase, amount]);

  return <Svg width={375} height={681} viewBox="0 0 375 681" testID="splash-cloth-pattern">
    <Defs>
      <ClipPath id="splash-cloth-window"><Rect x={1} y={335} width={374} height={346} /></ClipPath>
      <ClipPath id="splash-cloth-source"><Rect width={1443.28} height={290} transform="translate(-1015.82 332.799) rotate(4.66425)" /></ClipPath>
    </Defs>
    <G clipPath="url(#splash-cloth-window)">
      <G opacity={0.6} clipPath="url(#splash-cloth-source)">
        {dots.map((dot, index) => <ClothDot key={index} dot={dot} index={index} phase={phase} amount={amount} />)}
      </G>
    </G>
  </Svg>;
}
