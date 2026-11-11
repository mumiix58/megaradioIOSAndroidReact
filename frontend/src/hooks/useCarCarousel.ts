import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, runOnJS, runOnUI, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { CAROUSEL_STEP, carouselIndex, carouselLanding, carouselTapTarget } from '../utils/carCarousel';

interface Options { unit: number; count: number; visible: boolean; infinite?: boolean; tapTarget?:'carousel'|'current'; immediateStart?:boolean; onInteraction?: () => void; onPreview: (index: number) => void; onCommit: (index: number) => void }
export function useCarCarousel(options: Options) {
  const latest = useRef(options); latest.current = options;
  const position = useSharedValue(0), committed = useSharedValue(0), epoch = useSharedValue(0);
  const phase = useSharedValue(0), origin = useSharedValue(0), destination = useSharedValue(0);
  const panActive = useSharedValue(false);
  const [moving, setMoving] = useState(false);
  const reduced = useReducedMotion();
  const immediateStart=options.immediateStart===true;
  const unit = options.unit, count = options.count, visible=options.visible, currentTap = options.tapTarget === 'current';
  const physicalCount = options.count ? Math.ceil(7 / options.count) * options.count : 0;
  const slotsCount = Math.max(options.count, physicalCount);
  const publish = useCallback((next: number, owner: number) => {
    if (owner === epoch.value && latest.current.visible) latest.current.onPreview(latest.current.infinite ? next : carouselIndex(next, latest.current.count));
  }, [epoch]);
  const commitSelection = useCallback((next: number, owner: number) => {
    if (owner === epoch.value && latest.current.visible && latest.current.count) latest.current.onCommit(latest.current.infinite ? next : carouselIndex(next, latest.current.count));
  }, [epoch]);
  const beginInteraction = useCallback(() => latest.current.onInteraction?.(), []);
  useAnimatedReaction(() => ({ center: Math.round(position.value), phase: phase.value, epoch: epoch.value }), (next, previous) => {
    if (!previous || next.center !== previous.center || next.epoch !== previous.epoch) runOnJS(publish)(next.center, next.epoch);
    if (!previous || (next.phase === 0) !== (previous.phase === 0)) runOnJS(setMoving)(next.phase !== 0);
  }, [publish]);

  const resetUI = useCallback((next: number) => {
    'worklet';
    epoch.value++; cancelAnimation(position); position.value = next; committed.value = next; destination.value = next; phase.value = 0;
  }, [position, committed, destination, phase, epoch]);
  const reset = useCallback((next: number) => runOnUI(resetUI)(next), [resetUI]);
  const cancel = useCallback(() => { runOnUI(() => { 'worklet'; resetUI(committed.value); })(); }, [resetUI, committed]);
  useEffect(() => { if (!options.visible) cancel(); }, [options.visible, cancel]);
  useEffect(() => () => { runOnUI(() => { 'worklet'; epoch.value++; cancelAnimation(position); phase.value = 0; })(); }, [epoch, position, phase]);

  const settleUI = useCallback((target: number, duration: number, commit = true, kind = 2) => {
    'worklet';
    const owner = ++epoch.value;
    cancelAnimation(position); destination.value = target; phase.value = kind;
    if (duration === 0 || Math.abs(target - position.value) < 0.001) {
      position.value = target; committed.value = target; phase.value = 0;
      if (commit) runOnJS(commitSelection)(target, owner);
    } else position.value = withTiming(target, { duration, easing: !immediateStart && kind === 3 && duration > 600 ? Easing.inOut(Easing.cubic) : Easing.out(Easing.cubic) }, finished => {
      if (!finished || owner !== epoch.value) return;
      committed.value = target; phase.value = 0;
      if (commit) runOnJS(commitSelection)(target, owner);
    });
  }, [position, committed, destination, phase, epoch, commitSelection, immediateStart]);
  const grabUI = useCallback(() => {
    'worklet';
    if (phase.value === 1) return;
    runOnJS(beginInteraction)();
    epoch.value++; cancelAnimation(position); origin.value = position.value; phase.value = 1;
  }, [epoch, position, origin, phase, beginInteraction]);
  const stepUI = useCallback((direction: number, duration = 360) => {
    'worklet';
    settleUI(Math.round(phase.value === 3 ? destination.value : position.value) + direction, reduced ? 0 : duration, true, 3);
  }, [settleUI, position, phase, destination, reduced]);
  const step = useCallback((direction: number, duration = 360) => {runOnUI(stepUI)(direction,duration);},[stepUI]);
  const finishNow = useCallback(() => { runOnUI(() => { 'worklet'; settleUI(Math.round(position.value), reduced ? 0 : 180); })(); }, [settleUI, position, reduced]);
  const isMoving = useCallback(() => phase.value !== 0, [phase]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan().enabled(visible && count > 1).activeOffsetX([-5, 5]).failOffsetY([-18, 18])
      .onBegin(grabUI)
      .onStart(() => { panActive.value = true; })
      .onUpdate(event => { position.value = origin.value - event.translationX / (CAROUSEL_STEP * unit); })
      .onEnd(event => {
        position.value = origin.value - event.translationX / (CAROUSEL_STEP * unit);
        const landing = carouselLanding(position.value, event.velocityX / 1000, unit, reduced);
        settleUI(landing.target, landing.duration);
      })
      .onFinalize((_event, success) => {
        if (panActive.value && !success) resetUI(committed.value);
        panActive.value = false;
      });
    const tap = Gesture.Tap().enabled(visible).maxDistance(8).maxDuration(60000)
      .onBegin(grabUI)
      .onEnd((event, success) => {
        if (!success) return;
        const target = currentTap ? Math.round(position.value) : carouselTapTarget(event.x / unit, event.y / unit, position.value, slotsCount);
        settleUI(target ?? Math.round(position.value), reduced ? 0 : 380, target !== null);
      })
      .onFinalize((_event, success) => { if (!success && !panActive.value && phase.value === 1) resetUI(committed.value); });
    return Gesture.Race(pan, tap);
  }, [count, unit, slotsCount, reduced, visible, currentTap, grabUI, settleUI, resetUI, position, origin, panActive, committed, phase]);
  return { position, slotsCount, moving, motionPhase:phase, reset, cancel, stepUI, step, finishNow, isMoving, gesture };
}
