import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** Shared 180ms ease-out used by catalog pagination. User dragging cancels it. */
export function useCatalogPageScroll(scrollTo: (offset: number) => void) {
  const target = useRef(scrollTo);
  target.current = scrollTo;
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const top = useCallback(() => {
    cancel();
    const from = offset.current;
    let started: number | null = null;
    const step = (time: number) => {
      if (started === null) started = time;
      const progress = Math.min(1, (time - started) / 180);
      const next = from * Math.pow(1 - progress, 3);
      offset.current = next;
      target.current(next);
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  }, [cancel]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);
  return { top, cancel, scrollProps: { onScroll, scrollEventThrottle: 16, onScrollBeginDrag: cancel } };
}
