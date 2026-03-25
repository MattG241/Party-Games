import { useEffect, useRef, useCallback, useState } from 'react';
import { ServerMessage, ClientMessage } from '@party-blast/shared';

function getWsUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3001';
}
const SERVER_URL = getWsUrl();

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<((msg: ServerMessage) => void)[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg: ServerMessage = JSON.parse(evt.data);
          for (const h of handlersRef.current) h(msg);
        } catch {/* ignore */}
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimerRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const addHandler = useCallback((handler: (msg: ServerMessage) => void) => {
    handlersRef.current.push(handler);
    return () => {
      handlersRef.current = handlersRef.current.filter(h => h !== handler);
    };
  }, []);

  return { connected, send, addHandler };
}
