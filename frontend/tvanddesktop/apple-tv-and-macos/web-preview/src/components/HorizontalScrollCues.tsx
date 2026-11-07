import { CSSProperties, RefObject, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  id: string;
  scrollRef: RefObject<HTMLDivElement>;
  count: number;
  onNavigate?: (index: number) => void;
  itemSelector?: string;
  style?: CSSProperties;
}

/** Pointer buttons and TV edge cues; D-pad continues to navigate the cards. */
export function HorizontalScrollCues({ id, scrollRef, count, onNavigate, itemSelector = '[data-station-id]', style }: Props) {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let retired = false;
    const update = () => {
      if (retired) return;
      const left = el.scrollLeft > 5;
      const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 5;
      setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    const frame = requestAnimationFrame(update);
    el.addEventListener('scroll', update, false);
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => { retired = true; cancelAnimationFrame(frame); el.removeEventListener('scroll', update, false); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [scrollRef, count]);

  const move = (direction: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const left = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + direction * Math.min(600, el.clientWidth * 0.85)));
    const bounds = el.getBoundingClientRect();
    const scale = bounds.width / el.clientWidth || 1;
    const items = Array.from(el.querySelectorAll<HTMLElement>(itemSelector));
    const index = items.findIndex(item => (item.getBoundingClientRect().left - bounds.left) / scale + el.scrollLeft >= left - 2);
    if (items.length && onNavigate) onNavigate(index >= 0 ? index : items.length - 1);
    else el.scrollTo({ left, behavior: 'smooth' });
  };
  return <div data-testid={`${id}-scroll-cues`} className="carousel-cues" style={style}>
    {(['left', 'right'] as const).map(side => edges[side] && <div key={side} className={`carousel-edge carousel-edge-${side}`}>
      <button type="button" tabIndex={-1} aria-label={`Scroll ${side}`} data-testid={`${id}-scroll-${side}`}
        className={`carousel-arrow carousel-arrow-${side}`} onMouseDown={e => e.preventDefault()}
        onClick={e => { e.stopPropagation(); move(side === 'left' ? -1 : 1); }}>
        {side === 'left' ? <ChevronLeft size={24} strokeWidth={3} /> : <ChevronRight size={24} strokeWidth={3} />}
      </button>
    </div>)}
  </div>;
}