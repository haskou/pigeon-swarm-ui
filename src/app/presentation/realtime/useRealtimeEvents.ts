import type { RefObject } from 'react';

import { useEffect, useRef } from 'react';

import type { Session } from '../../../shared/domain/pigeonResources.types';
import type {
  RealtimeDomainEvent,
  RealtimeTypingInput,
  RealtimeTypingMessage,
} from '../../../shared/infrastructure/realtime/RealtimeGateway';

import { applicationContainer } from '../../composition/applicationContainer';

type RealtimeHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onDomainEvent: (event: RealtimeDomainEvent) => void;
  onReconnecting?: () => void;
  onTyping?: (message: RealtimeTypingMessage) => void;
};

type RealtimeSubscription = {
  handlersRef: RefObject<RealtimeHandlers>;
};

type SharedRealtimeConnection = {
  attempt: number;
  closeTimer?: number;
  connect: () => Promise<void>;
  connectPromise: Promise<void> | null;
  reconnectTimer?: number;
  session: Session;
  socket: WebSocket | null;
  subscribers: Set<RealtimeSubscription>;
};

const realtimeConnections = new Map<string, SharedRealtimeConnection>();
const sharedConnectionCloseDelayMs = 1000;

export function useRealtimeEvents(
  session: Session,
  handlers: RealtimeHandlers,
): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const subscription = { handlersRef };
    const connection = subscribeRealtime(session, subscription);

    return () => {
      unsubscribeRealtime(connection, subscription);
    };
  }, [session.identity.id, session.keyPair]);
}

function subscribeRealtime(
  session: Session,
  subscription: RealtimeSubscription,
): SharedRealtimeConnection {
  const key = realtimeConnectionKey(session);
  const connection =
    realtimeConnections.get(key) ?? createRealtimeConnection(key, session);

  if (connection.closeTimer !== undefined) {
    window.clearTimeout(connection.closeTimer);
    connection.closeTimer = undefined;
  }

  connection.subscribers.add(subscription);

  if (!connection.socket && !connection.connectPromise) {
    void connection.connect();
  } else if (connection.socket?.readyState === WebSocket.OPEN) {
    subscription.handlersRef.current.onConnected?.();
  }

  return connection;
}

function unsubscribeRealtime(
  connection: SharedRealtimeConnection,
  subscription: RealtimeSubscription,
): void {
  connection.subscribers.delete(subscription);
  subscription.handlersRef.current.onDisconnected?.();

  if (connection.subscribers.size > 0) return;

  if (connection.reconnectTimer !== undefined) {
    window.clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = undefined;
  }

  connection.closeTimer = window.setTimeout(() => {
    if (connection.subscribers.size > 0) return;

    connection.socket?.close();
    connection.socket = null;
    connection.connectPromise = null;
    realtimeConnections.delete(realtimeConnectionKey(connection.session));
  }, sharedConnectionCloseDelayMs);
}

function createRealtimeConnection(
  key: string,
  session: Session,
): SharedRealtimeConnection {
  const connection: SharedRealtimeConnection = {
    attempt: 0,
    connect: () => Promise.resolve(),
    connectPromise: null,
    session,
    socket: null,
    subscribers: new Set(),
  };

  connection.connect = async () => {
    if (connection.connectPromise) return connection.connectPromise;

    connection.connectPromise = connectRealtime(connection).finally(() => {
      connection.connectPromise = null;
    });

    return connection.connectPromise;
  };

  realtimeConnections.set(key, connection);

  return connection;
}

async function connectRealtime(
  connection: SharedRealtimeConnection,
): Promise<void> {
  try {
    const nextSocket = await applicationContainer.connectRealtime(
      connection.session,
      (message) => {
        if (message.type === 'connection_ack') {
          notifySubscribers(connection, (handlers) => handlers.onConnected?.());

          return;
        }

        if (message.type === 'heartbeat_ack') return;

        if (message.type === 'typing') {
          notifySubscribers(connection, (handlers) =>
            handlers.onTyping?.(message),
          );

          return;
        }

        notifySubscribers(connection, (handlers) =>
          handlers.onDomainEvent(message.event),
        );
      },
    );

    if (connection.subscribers.size === 0) {
      nextSocket.close();

      return;
    }

    connection.socket = nextSocket;
    nextSocket.addEventListener('open', () => {
      connection.attempt = 0;
    });
    nextSocket.addEventListener('close', () => {
      if (connection.socket === nextSocket) connection.socket = null;
      scheduleRealtimeReconnect(connection);
    });
    nextSocket.addEventListener('error', () => {
      notifySubscribers(connection, (handlers) => handlers.onDisconnected?.());
      nextSocket.close();
    });
  } catch {
    scheduleRealtimeReconnect(connection);
  }
}

function scheduleRealtimeReconnect(connection: SharedRealtimeConnection): void {
  if (connection.subscribers.size === 0) return;

  if (connection.reconnectTimer !== undefined) return;

  notifySubscribers(connection, (handlers) => handlers.onReconnecting?.());
  const delay = Math.min(30000, 1000 * 2 ** connection.attempt);
  const jitter = Math.floor(Math.random() * 500);

  connection.attempt += 1;
  connection.reconnectTimer = window.setTimeout(() => {
    connection.reconnectTimer = undefined;
    void connection.connect();
  }, delay + jitter);
}

function notifySubscribers(
  connection: SharedRealtimeConnection,
  notify: (handlers: RealtimeHandlers) => void,
): void {
  connection.subscribers.forEach((subscription) => {
    notify(subscription.handlersRef.current);
  });
}

function realtimeConnectionKey(session: Session): string {
  return session.identity.id;
}

export function sendRealtimeTyping(
  session: Session,
  input: RealtimeTypingInput,
): void {
  const socket = realtimeConnections.get(
    realtimeConnectionKey(session),
  )?.socket;

  if (!socket) return;

  applicationContainer.sendRealtimeTyping(socket, input);
}
