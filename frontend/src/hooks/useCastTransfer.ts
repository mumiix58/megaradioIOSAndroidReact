import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleCast } from '../services/nativeCasting';
import stationService from '../services/stationService';
import { createCastMedia, transferCastMedia } from '../utils/castMedia';
import type { Station } from '../types';

interface Options {
  station?: Station | null;
  streamUrl?: string | null;
  nowPlaying?: { title?: string; artist?: string } | null;
  pauseLocal?: () => void | Promise<void>;
  onError?: () => void;
}

/** Native picker owns discovery and disconnection. Load once after an explicit Cast gesture. */
export function useCastTransfer(options: Options) {
  const latest = useRef(options); latest.current = options;
  const [remoteStationId, setRemoteStationId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [armed, setArmed] = useState(0);
  const sessionRef = useRef<any>(null);
  const attempted = useRef<string | null>(null);
  const failed = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const pending = useRef<string | null>(null);
  const arm = useCallback(() => { if (failed.current) { attempted.current = null; failed.current = false; } setArmed(value => value + 1); }, []);
  useEffect(() => {
    mounted.current = true;
    if (!GoogleCast) return () => { mounted.current = false; };
    const manager = GoogleCast.getSessionManager();
    let active = true;
    const update = (value: any) => { if (!active) return; generation.current++; pending.current = null; sessionRef.current = value; setSession(value); if (!value) setRemoteStationId(null); setConnecting(false); };
    const started = (value: any) => { update(value); if (active) arm(); };
    const subscriptions = [
      manager.onSessionStarting(() => { if (active) setConnecting(true); }),
      manager.onSessionStarted(started), manager.onSessionResumed((value: any) => { attempted.current = null; update(value); }),
      manager.onSessionResuming(() => { if (active) setConnecting(true); }),
      manager.onSessionEnded(() => { update(null); attempted.current = null; setArmed(0); }),
      manager.onSessionSuspended(() => update(null)),
      manager.onSessionStartFailed(() => { if (active) { setConnecting(false); latest.current.onError?.(); } }),
    ];
    const initialGeneration = generation.current;
    manager.getCurrentCastSession().then((value: any) => { if (generation.current === initialGeneration) update(value); }).catch(() => { /* Picker remains available for retry. */ });
    return () => { active = false; mounted.current = false; generation.current++; subscriptions.forEach((subscription: any) => subscription.remove()); };
  }, [arm]);

  useEffect(() => {
    if (!armed || !session || !options.station) return;
    const station = options.station;
    const key = `${session.id || 'session'}:${station._id}:${options.streamUrl || ''}`;
    if (attempted.current === key || pending.current === key) return;
    const requestGeneration = generation.current;
    attempted.current = key; pending.current = key;
    const isCurrent = () => mounted.current && generation.current === requestGeneration && sessionRef.current === session && latest.current.station?._id === station._id && (latest.current.streamUrl || '') === (options.streamUrl || '');
    void (async () => {
      try {
        let url = options.streamUrl || station.urlResolved || station.url_resolved || station.url;
        if (/\.(pls|m3u|xspf)(?:[?#]|$)/i.test(url || '')) {
          const resolved = await stationService.resolveStream(url!);
          url = resolved?.candidates?.find((candidate: unknown) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate));
          if (!url) throw new Error('cast_invalid_stream');
        }
        if (!isCurrent()) return;
        await transferCastMedia(session.client || session.getClient(), createCastMedia(station, url, latest.current.nowPlaying), options.pauseLocal, isCurrent);
        if (isCurrent()) { failed.current = false; setRemoteStationId(station._id); }
      } catch {
        if (isCurrent()) { failed.current = true; latest.current.onError?.(); }
      } finally { if (generation.current === requestGeneration && pending.current === key) pending.current = null; }
    })();
  }, [armed, session, options.station?._id, options.streamUrl]);
  return { arm, connected: !!session, connecting, remoteStationId, client: session?.client || session?.getClient?.() || null };
}
