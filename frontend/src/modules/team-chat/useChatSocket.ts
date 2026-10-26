import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { authFrame, socketUrl } from '@/shared/lib/socketAuth';
import type { ChatEvent } from './types';

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed';

/** While the socket is not open the page refreshes itself this often. */
export const POLL_INTERVAL_MS = 15000;

/** Reconnect delay: 1 s, 2 s, 4 s ... capped at 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempt));
}

interface Options {
  enabled: boolean;
  roomIds: string[];
  onEvent: (e: ChatEvent) => void;
  /** Called every POLL_INTERVAL_MS while the socket is down (fallback refresh). */
  onPoll: () => void;
}

/**
 * Live chat socket (`/api/v1/team-chat/ws/`, first-frame JWT like the other realtime sockets) with exponential
 * reconnect and a polling fallback while it is down.
 */
export function useChatSocket({ enabled, roomIds, onEvent, onPoll }: Options): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const roomsRef = useRef<string[]>(roomIds);
  const eventRef = useRef(onEvent);
  const pollRef = useRef(onPoll);
  eventRef.current = onEvent;
  pollRef.current = onPoll;
  roomsRef.current = roomIds;

  // keep the server-side subscription in step with the room list
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'subscribe', room_ids: roomIds }));
  }, [roomIds]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = useAuthStore.getState().accessToken;
      if (closed || !token) {
        setStatus('closed');
        return;
      }
      setStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(socketUrl('/api/v1/team-chat/ws/'));
      } catch {
        setStatus('closed');
        timer = setTimeout(connect, reconnectDelay(attempt++));
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(authFrame(token));
      };
      ws.onmessage = (msg: MessageEvent<string>) => {
        let data: ChatEvent;
        try {
          data = JSON.parse(msg.data) as ChatEvent;
        } catch {
          return;
        }
        if (data.event === 'ready') {
          attempt = 0;
          setStatus('open');
          if (roomsRef.current.length) ws.send(JSON.stringify({ type: 'subscribe', room_ids: roomsRef.current }));
        }
        eventRef.current(data);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (closed) return;
        setStatus('closed');
        timer = setTimeout(connect, reconnectDelay(attempt++));
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled]);

  // polling fallback
  useEffect(() => {
    if (!enabled || status === 'open') return;
    const id = setInterval(() => pollRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, status]);

  return status;
}
