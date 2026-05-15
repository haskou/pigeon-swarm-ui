import { useEffect, useRef } from 'react';

import type { Session } from '../../domain/types';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';

import { pigeonApplication } from '../../application/applicationContainer';

type RealtimeHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onDomainEvent: (event: RealtimeDomainEvent) => void;
  onReconnecting?: () => void;
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
    let connect = (): Promise<void> => Promise.resolve();

    const scheduleReconnect = () => {
      if (cancelled) return;

      handlersRef.current.onReconnecting?.();
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 500);

      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay + jitter);
    };

    connect = async () => {
      try {
        const nextSocket = await pigeonApplication.connectRealtime(
          session,
          (message) => {
            if (cancelled) return;

            if (message.type === 'connection_ack') {
              handlersRef.current.onConnected?.();

              return;
            }

            if (message.type === 'heartbeat_ack') return;

            handlersRef.current.onDomainEvent(message.event);
          },
        );

        if (cancelled) {
          nextSocket.close();

          return;
        }

        socket = nextSocket;

        socket.addEventListener('open', () => {
          attempt = 0;
        });
        socket.addEventListener('close', scheduleReconnect);
        socket.addEventListener('error', () => {
          handlersRef.current.onDisconnected?.();
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
      handlersRef.current.onDisconnected?.();
      socket?.close();
    };
  }, [session.encryptedKeyPair, session.identity.id, session.password]);
}
