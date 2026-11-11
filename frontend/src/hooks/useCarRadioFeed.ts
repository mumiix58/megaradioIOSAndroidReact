import { AppState } from 'react-native';
import { rememberWorldRadio, worldCountryRotation, worldRadioHistory } from '../services/worldRadioHistory';
import { PreparedWorldRadio } from '../services/preparedWorldRadio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFavoritesStore } from '../store/favoritesStore';
import { useLocationStore } from '../store/locationStore';
import { usePlayerStore } from '../store/playerStore';
import { getCarRadioPage, getWorldTransitionRadios } from '../services/carRadioService';
import { CarRadioFeed, uniqueRadios } from '../utils/carRadioFeed';
import { carouselIndex } from '../utils/carCarousel';
import { isGlobalCountry } from '../utils/countryScope';
import type { Station } from '../types';

export function useCarRadioFeed(visible: boolean, first: Station | null | undefined) {
  const [worldCards,setWorldCards]=useState<Station[]>([]);
  useEffect(()=>{if(!visible)return;let canceled=false;void getWorldTransitionRadios().then(cards=>{if(!canceled)setWorldCards(cards);}).catch(()=>{});return()=>{canceled=true;};},[visible]);
  const [revision, refresh] = useState(0);
  const session = useRef(0), open = useRef(false);
  const finite = useRef<Station[] | null>(null), feed = useRef<CarRadioFeed | null>(null);
  const source = useRef<{ kind: 'favorites' | 'browse'; country?: string }>({ kind: 'browse' });
  const center = useRef(0);
  const draws = useRef(new Set<string>());
  const handoff = useRef<{ promise: Promise<Station | null>; station?: Station; at: number } | null>(null);
  const worldDeck = useRef<PreparedWorldRadio | null>(null);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldExclusions = useCallback(() => {
    const excluded = new Set(draws.current);
    const current = usePlayerStore.getState().currentStation;
    if (current) excluded.add(current._id);
    return excluded;
  }, []);
  const stopWorld = useCallback(() => {
    if (warmTimer.current) clearTimeout(warmTimer.current);
    warmTimer.current = null; handoff.current = null; worldDeck.current?.dispose(); worldDeck.current = null;
  }, []);
  const prepareWorld = useCallback(() => {
    if (handoff.current) return;
    if (!open.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    if (!worldDeck.current) worldDeck.current = new PreparedWorldRadio();
    void worldDeck.current.prepare(worldExclusions());
  }, [worldExclusions]);
  const preparing = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; session.current++; stopWorld(); }; }, []);
  useEffect(() => {
    if (!visible) { stopWorld(); open.current = false; session.current++; setDrawing(false); return; }
    if (open.current || !first) return;
    open.current = true;
    const owner = ++session.current;
    warmTimer.current = setTimeout(prepareWorld, 800);
    const notify = () => { if (alive.current && owner === session.current) refresh(x => x + 1); };
    const player = usePlayerStore.getState(), location = useLocationStore.getState();
    const origin = player.playbackOrigin?.stationId === first._id ? player.playbackOrigin : null;
    const selected = location.countryEnglish || location.country;
    source.current = origin?.kind === 'favorites' ? { kind: 'favorites', country: isGlobalCountry(selected) ? undefined : selected || undefined } : { kind: 'browse', country: origin ? origin.country : isGlobalCountry(selected) ? undefined : selected || undefined };
    rememberWorldRadio(first);
    center.current = 0; setNotice(''); draws.current.clear(); preparing.current = false;
    if (source.current.kind === 'favorites') {
      finite.current = uniqueRadios([first, ...useFavoritesStore.getState().getSortedFavorites()]);
      feed.current = null;
      if (finite.current.length < 5) { preparing.current = true; void getCarRadioPage(1, source.current.country).then(data => {
        if (owner !== session.current) return;
        finite.current = uniqueRadios([...finite.current!, ...data.stations]).slice(0, 5); preparing.current = false; notify();
      }).catch(() => { if (owner === session.current) { preparing.current = false; setNotice('connection'); notify(); } }); }
    } else {
      finite.current = null;
      const country = source.current.country;
      feed.current = new CarRadioFeed(first, page => getCarRadioPage(page, country), notify);
      void feed.current.ensure(0);
    }
    notify();
  }, [visible, first?._id]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { stopWorld(); setDrawing(false); } else if (open.current) prepareWorld();
    });
    return () => subscription.remove();
  }, [prepareWorld, stopWorld]);
  const ensure = useCallback((ordinal: number) => { center.current = ordinal; if (feed.current) void feed.current.ensure(ordinal); }, []);
  const get = useCallback((ordinal: number) => finite.current ? finite.current[carouselIndex(ordinal, finite.current.length)] : feed.current?.get(ordinal), []);
  const resolve = useCallback(async (ordinal: number) => {
    const ready = get(ordinal);
    if (ready) return ready;
    if (feed.current) await feed.current.ensure(ordinal);
    return get(ordinal);
  }, [get]);
  const adopt = useCallback((station: Station) => {
    let ordinal = center.current;
    if (finite.current) {
      const found = finite.current.findIndex(s => s._id === station._id);
      if (found >= 0) ordinal = found;
      else { finite.current = [station, ...finite.current]; ordinal = 0; }
    } else if (feed.current) {
      const found = [...feed.current.entries].find(([, s]) => s._id === station._id);
      if (found) ordinal = found[0]; else feed.current.replace(ordinal, station);
    }
    center.current = ordinal; refresh(x => x + 1); return ordinal;
  }, []);
  // One unclaimed result serves all overlapping releases. Only the latest UI intent
  // may publish it; touching the dial again never queues another decoder probe.
  const world = useCallback((): Promise<Station | null> => {
    const cached = handoff.current;
    if (cached && (!cached.station || (!worldRadioHistory.has(cached.station) && Date.now() - cached.at < 15000))) return cached.promise;
    handoff.current = null;
    prepareWorld();
    const deck = worldDeck.current, owner = session.current;
    if (!deck) return Promise.resolve(null);
    setDrawing(true); setNotice('');
    const claim = { promise: Promise.resolve<Station | null>(null), at: 0, station: undefined as Station | undefined };
    handoff.current = claim;
    claim.promise = (async () => {
      try {
        const station = await deck.take(worldExclusions());
        if (owner !== session.current || deck !== worldDeck.current || handoff.current !== claim) return null;
        if (!station) { setNotice('empty'); handoff.current = null; return null; }
        claim.station = station; claim.at = Date.now();
        return station;
      } catch {
        if (handoff.current === claim) { handoff.current = null; if (alive.current) setNotice('connection'); }
        return null;
      } finally {
        if (alive.current && owner === session.current && deck === worldDeck.current) setDrawing(false);
      }
    })();
    return claim.promise;
  }, [prepareWorld, worldExclusions]);
  const acceptWorld = useCallback((station: Station) => {
    if (!open.current || handoff.current?.station !== station) return false;
    handoff.current = null;
    draws.current.add(station._id);
    worldCountryRotation.remember(station);
    rememberWorldRadio(station);
    if (finite.current) finite.current = [station, ...finite.current];
    else feed.current?.replace(center.current, station);
    refresh(x => x + 1);
    if (warmTimer.current) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(prepareWorld, 600);
    return true;
  }, [prepareWorld]);
  return { worldCards, get, ensure, resolve, adopt, world, acceptWorld, prepareWorld, drawing, preparing: preparing.current, notice: notice || (feed.current?.error ? 'connection' : ''), source: source.current, finite: !!finite.current, count: finite.current?.length || 17, revision, center };
}
