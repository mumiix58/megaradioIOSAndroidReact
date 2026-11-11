import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, SharedValue, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { worldDialNotch, worldDialPhase } from '../utils/worldDialMotion';
import { useTunerTick } from '../hooks/useTunerTick';
import { DISCOVERY_RELEASE_DURATION, discoveryReleaseEasing } from '../utils/discoveryPullMotion';
import { ElasticFrequency } from './ElasticFrequency';

export const WorldRadioDial = React.memo(function WorldRadioDial({ unit, disabled, busy = false, motion, phase, onPrepare, onStart, onRelease, onReleaseUI, onRest, labels, appearance='ruler', playing=false, motionScale=.18, showArrows=true, releaseSlots=0 }: { unit: number; disabled: boolean; busy?: boolean; motion: SharedValue<number>; phase: SharedValue<number>; onRest: () => void; onPrepare: () => void; onStart: () => void; onRelease: (direction?:'left'|'right') => void; onReleaseUI?:(direction:'left'|'right')=>void; appearance?:'ruler'|'elastic';playing?:boolean;motionScale?:number;showArrows?:boolean;releaseSlots?:number;labels?: {accessibility:string;hint:string;idle:string;release:string} }) {
  const { t } = useTranslation();
  const pull = useSharedValue(0), active = useSharedValue(false), notch = useSharedValue(0);
  const pressed = useSharedValue(false), epoch = useSharedValue(0), grip = useSharedValue(0), travel = useSharedValue(0);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; epoch.value++; }; }, [epoch]);
  const finishRest = useCallback((token: number) => { if (live.current && epoch.value === token) onRest(); }, [epoch, onRest]);
  const reduced = useReducedMotion();
  useEffect(() => () => { cancelAnimation(pull); cancelAnimation(motion); cancelAnimation(phase); motion.value = 0; phase.value = 0; }, [pull, motion, phase]);
  const [armed, setArmed] = useState(false);
  const tick = useTunerTick();
  useAnimatedReaction(() => ({ notch: Math.trunc(pull.value / (7 * unit)), ready: Math.abs(pull.value) >= 30 * unit, gear: Math.round(phase.value / 0.65) }), (next, old) => {
    if (old && next.notch !== old.notch && (active.value || Math.abs(pull.value) > 3 * unit)) runOnJS(tick)();
    if (old && !active.value && next.gear !== old.gear) runOnJS(tick)();
    if (!old || next.ready !== old.ready) runOnJS(setArmed)(next.ready);
  });
  const settle = useCallback((released: boolean, direction:'left'|'right'='left') => {
    'worklet';
    active.value = false; pressed.value = false;
    const token = epoch.value;
    if (reduced) { pull.value = 0; motion.value = 0; phase.value = 0; runOnJS(finishRest)(token); }
    else if (released) {
      const spring = { mass: 0.7, damping: 11, stiffness: 210, restDisplacementThreshold: 0.15, restSpeedThreshold: 0.2 };
      pull.value = withSpring(0, spring); motion.value = withSpring(0, spring);
      const finish = (finished?: boolean) => { 'worklet'; if (finished && epoch.value === token) runOnJS(finishRest)(token); };
      if(releaseSlots>0){
        // A whole ring lands at the same slot; radio selection stays with the verified feed.
        const target=phase.value+(direction==='left'?1:-1)*releaseSlots;
        phase.value=withTiming(target,{duration:DISCOVERY_RELEASE_DURATION,easing:discoveryReleaseEasing},finished=>{
          if(finished&&epoch.value===token){phase.value=0;runOnJS(finishRest)(token);}
        });
        return;
      }
      const back = withSpring(0, { mass: 0.6, damping: 15, stiffness: 240, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.01 }, finish);
      phase.value = notch.value ? withSequence(withTiming(worldDialPhase(notch.value), { duration: 120 }), back) : back;
    } else { pull.value = withTiming(0, { duration: 180 }); motion.value = withTiming(0, { duration: 180 }); phase.value = withTiming(0, { duration: 180 }, finished => { if (finished && epoch.value === token) runOnJS(finishRest)(token); }); }
  }, [active, pressed, epoch, reduced, pull, motion, phase, notch, finishRest, releaseSlots]);
  const gesture = useMemo(() => Gesture.Pan().enabled(!disabled).maxPointers(1).activeOffsetX([-4, 4]).failOffsetY([-15, 15])
    .onBegin(() => {
      epoch.value++; pressed.value = true; active.value = false;
      cancelAnimation(pull); cancelAnimation(motion); cancelAnimation(phase);
      grip.value = pull.value; travel.value = 0; notch.value = 0;
      runOnJS(onPrepare)(); runOnJS(onStart)();
    })
    .onStart(() => {
      active.value = true;
      // A caught return blends back without snapping the overlapping cards.
      if (phase.value !== 0) phase.value = withTiming(0, { duration: 120 });
    })
    .onUpdate(e => {
      if (!active.value) return;
      travel.value = e.translationX;
      const stretch = Math.sign(e.translationX) * (1 - Math.exp(-Math.abs(e.translationX) / (95 * unit))) * 76 * unit;
      pull.value = Math.max(-76 * unit, Math.min(76 * unit, grip.value + stretch));
      motion.value = reduced ? 0 : pull.value * motionScale;
      const next = worldDialNotch(e.translationX, unit);
      if (next !== notch.value) { notch.value = next; runOnJS(tick)(); }
    })
    .onEnd(() => {
      if (!active.value) return;
      const released = Math.abs(travel.value) >= -95 * unit * Math.log(1 - 30 / 76);
      const direction=travel.value<0?'left':'right';
      settle(released,direction);
      if (released) {if(onReleaseUI)onReleaseUI(direction);else runOnJS(onRelease)(direction);}
    })
    .onFinalize(() => { if (pressed.value || active.value) settle(false); }), [unit, disabled, onPrepare, onStart, onRelease, onReleaseUI, settle, motion, phase, reduced, motionScale, notch, tick, epoch, pressed, grip, travel, active, pull]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: pull.value }], opacity: disabled ? 0.25 : 0.45 + Math.abs(pull.value) / (180 * unit) }));
  const release = useCallback(() => { if (!disabled) { epoch.value++; cancelAnimation(pull); cancelAnimation(motion); cancelAnimation(phase); pull.value = 0; motion.value = 0; phase.value = 0; onStart(); settle(true,'left'); onRelease('left'); } }, [disabled, onStart, onRelease, settle, epoch, pull, motion, phase]);
  return <GestureDetector gesture={gesture} touchAction="pan-y" userSelect="none">
    <View testID="car-world-dial" accessible accessibilityRole="button" accessibilityLabel={labels?.accessibility||t('car_world_dial', 'Pull and release to discover a random radio from around the world')} accessibilityHint={labels?.hint||t('car_world_hint', 'Drag left or right, then release')} accessibilityState={{ disabled, busy: disabled || busy }} onAccessibilityTap={release}
      {...({ tabIndex: disabled ? -1 : 0, onKeyDown: (e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); release(); } } } as any)}
      style={{ width: (appearance==='elastic'?304:280) * unit, height: (appearance==='elastic'?80:46) * unit, alignSelf: 'center', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' }}>
      {appearance==='elastic'?<ElasticFrequency unit={unit} pull={pull} playing={playing} showArrows={showArrows}/>:<><Animated.View pointerEvents="none" style={[{ height: 23 * unit, flexDirection: 'row', gap: 6 * unit, alignItems: 'center' }, style]}>
        {Array.from({ length: 49 }, (_, i) => <View key={i} style={{ width: unit, height: (i % 5 === 0 ? 17 : i % 2 === 0 ? 10 : 6) * unit, borderRadius: unit, backgroundColor: '#CFD1D5', opacity: Math.max(0.08, 1 - Math.abs(i - 24) / 24) }} />)}
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, width: 2 * unit, height: 23 * unit, borderRadius: unit, backgroundColor: '#FF349B', opacity: armed ? 1 : 0.65 }} /></>}
      <Text pointerEvents="none" style={{ marginTop: 5 * unit, color: armed ? '#FF70B7' : '#85888F', fontFamily: 'Ubuntu-Medium', fontSize: 8 * unit, letterSpacing: 1.6 * unit }}>{armed ? labels?.release||t('car_world_release', 'RELEASE TO EXPLORE') : disabled || busy ? t('car_world_finding', 'Finding a station…') : labels?.idle||t('car_world_label', 'WORLD · PULL & RELEASE')}</Text>
    </View>
  </GestureDetector>;
});
