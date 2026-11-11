import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { chatService } from '../services/chatService';

/** One foreground connection per chat screen, authenticated using the web's single-use ticket. */
export function useChatSocket(enabled: boolean, activeId: string | undefined, identity: string, onEvent: (event: any) => void) {
  const [connected, setConnected] = useState(false);
  const callback = useRef(onEvent); callback.current = onEvent;
  const active = useRef(activeId); active.current = activeId;
  const socket = useRef<WebSocket | null>(null);
  const send = useCallback((event: object) => { if (socket.current?.readyState === 1) socket.current.send(JSON.stringify(event)); }, []);
  useEffect(() => { send({ type: 'chat:active', withUserId: activeId || null }); }, [activeId, send]);
  useEffect(() => {
    if (!enabled || !identity) return;
    let disposed = false, foreground = AppState.currentState !== 'background', generation = 0, attempt = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined, heartbeat: ReturnType<typeof setInterval> | undefined;
    const close = () => { generation++; clearTimeout(reconnect); clearInterval(heartbeat); const ws = socket.current; socket.current = null; ws?.close(); setConnected(false); };
    const connect = async () => {
      const version = ++generation;
      try {
        const ticket = await chatService.ticket();
        if (disposed || !foreground || version !== generation) return;
        const ws = new WebSocket(`wss://api.themegaradio.com/ws/chat?ticket=${encodeURIComponent(ticket)}`);
        socket.current = ws;
        ws.onopen = () => { if (disposed || version !== generation) { ws.close(); return; } attempt = 0; setConnected(true); send({ type: 'chat:active', withUserId: active.current || null }); heartbeat = setInterval(() => send({ type: 'chat:ping' }), 25000); };
        ws.onmessage = event => { if (version !== generation || disposed) return; try { callback.current(JSON.parse(String(event.data))); } catch {} };
        ws.onclose = () => { if (version !== generation || disposed) return; clearInterval(heartbeat); setConnected(false); if (foreground) reconnect = setTimeout(connect, Math.min(15000, 750 * 2 ** attempt++) + Math.random()*300); };
        ws.onerror = () => ws.close();
      } catch (reason: any) { if ([401,403].includes(reason?.response?.status)) { setConnected(false); return; } if (!disposed && foreground && version === generation) reconnect = setTimeout(connect, Math.min(15000, 1000 * 2 ** attempt++)); }
    };
    if (foreground) void connect();
    const subscription = AppState.addEventListener('change', state => { const next = state === 'active'; if (next === foreground) return; foreground = next; close(); if (next) void connect(); });
    return () => { disposed = true; subscription.remove(); close(); };
  }, [enabled, identity, send]);
  return { connected, send };
}
