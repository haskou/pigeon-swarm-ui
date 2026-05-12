import { useEffect, useRef } from 'react';

import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';
import type { Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';

type RealtimeHandlers = {
  onConnected?: () => void;
  onDomainEvent: (event: RealtimeDomainEvent) => void;
};

export function useRealtimeEvents(
  session: Session,
  handlers: RealtimeHandlers,
): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | undefined;
    let socket: WebSocket | null = null;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (cancelled) return;

      const delay = Math.min(30000, 1000 * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 500);

      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay + jitter);
    };

    const connect = async () => {
      try {
        socket = await pigeonApplication.connectRealtime(session, (message) => {
          if (message.type === 'connection_ack') {
            handlersRef.current.onConnected?.();
            return;
          }

          handlersRef.current.onDomainEvent(message.event);
        });

        socket.addEventListener('open', () => {
          attempt = 0;
        });
        socket.addEventListener('close', scheduleReconnect);
        socket.addEventListener('error', () => {
          socket?.close();
        });
      } catch {
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [session.encryptedKeyPair, session.identity.id, session.password]);
}
