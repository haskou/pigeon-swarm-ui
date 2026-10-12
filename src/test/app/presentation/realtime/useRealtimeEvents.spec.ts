import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { setImmediate as flushConnections } from 'node:timers/promises';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  closeAllRealtimeConnections,
  subscribeRealtimeMailboxHints,
  useRealtimeEvents,
} from '../../../../app/presentation/realtime/useRealtimeEvents';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    realtime: { connect: jest.fn(), subscribeMailbox: jest.fn() },
  },
}));

class SocketDouble {
  public readonly addEventListener = jest.fn();

  public readonly close = jest.fn();

  public readonly readyState = 1;

  public emit(type: string): void {
    this.addEventListener.mock.calls
      .filter(([eventType]) => eventType === type)
      .forEach(([, listener]) => (listener as () => void)());
  }
}

const handlers = {
  onDomainEvent: jest.fn(),
  onReconnecting: jest.fn(),
};
const session = { identity: { id: 'identity-a' } } as unknown as Session;

function mountRealtime(): () => void {
  mockEffects.length = 0;
  useRealtimeEvents(session, handlers);

  const cleanups = mockEffects.map((effect) => effect());

  return () => {
    cleanups.forEach((cleanup) => {
      if (typeof cleanup === 'function') cleanup();
    });
  };
}

describe('shared realtime connections', () => {
  const connect = jest.mocked(applicationContainer.realtime.connect);

  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (...args: Parameters<typeof clearTimeout>) =>
        clearTimeout(...args),
      setTimeout: (...args: Parameters<typeof setTimeout>) =>
        setTimeout(...args),
    });
    Reflect.set(globalThis, 'WebSocket', { OPEN: 1 });
    connect.mockReset();
  });

  afterEach(() => {
    closeAllRealtimeConnections();
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'WebSocket');
  });

  it('closes the shared socket immediately on logout instead of after the grace period', async () => {
    const socket = new SocketDouble();

    connect.mockResolvedValue(socket as unknown as WebSocket);
    mountRealtime();
    await flushConnections();

    closeAllRealtimeConnections();

    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it('stops pending reconnects when logout happens while the connection is down', async () => {
    const socket = new SocketDouble();

    connect.mockResolvedValue(socket as unknown as WebSocket);
    mountRealtime();
    await flushConnections();

    socket.emit('close');
    closeAllRealtimeConnections();
    jest.advanceTimersByTime(60_000);
    await flushConnections();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('closes a socket that finishes connecting after logout', async () => {
    const socket = new SocketDouble();

    connect.mockImplementation(async () => {
      await flushConnections();

      return socket as unknown as WebSocket;
    });
    mountRealtime();
    closeAllRealtimeConnections();

    await flushConnections();

    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it('keeps a reconnected session socket open when a stale subscriber unmounts', async () => {
    const staleSocket = new SocketDouble();
    const freshSocket = new SocketDouble();

    connect
      .mockResolvedValueOnce(staleSocket as unknown as WebSocket)
      .mockResolvedValueOnce(freshSocket as unknown as WebSocket);
    const unmountStale = mountRealtime();
    await flushConnections();

    closeAllRealtimeConnections();
    mountRealtime();
    await flushConnections();

    unmountStale();
    jest.advanceTimersByTime(60_000);

    expect(freshSocket.close).not.toHaveBeenCalled();
  });
});

describe('mailbox hint subscriptions', () => {
  type OnMessage = Parameters<typeof applicationContainer.realtime.connect>[1];

  const connect = jest.mocked(applicationContainer.realtime.connect);
  const subscribeMailbox = jest.mocked(
    applicationContainer.realtime.subscribeMailbox,
  );
  const target = { mailboxId: 'mailbox-a', readToken: 'token-a' };
  let deliver: OnMessage = () => undefined;

  function connectTo(...sockets: SocketDouble[]): void {
    sockets.forEach((socket) => {
      connect.mockImplementationOnce((_session, onMessage) => {
        deliver = onMessage;

        return Promise.resolve(socket as unknown as WebSocket);
      });
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (...args: Parameters<typeof clearTimeout>) =>
        clearTimeout(...args),
      setTimeout: (...args: Parameters<typeof setTimeout>) =>
        setTimeout(...args),
    });
    Reflect.set(globalThis, 'WebSocket', { OPEN: 1 });
    connect.mockReset();
    subscribeMailbox.mockReset();
  });

  afterEach(() => {
    closeAllRealtimeConnections();
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'WebSocket');
  });

  it('hands a mailbox hint only to listeners of that mailbox', async () => {
    connectTo(new SocketDouble());
    mountRealtime();
    await flushConnections();
    const onHintA = jest.fn();
    const onHintB = jest.fn();
    subscribeRealtimeMailboxHints(session, target, onHintA);
    subscribeRealtimeMailboxHints(
      session,
      { mailboxId: 'mailbox-b', readToken: 'token-b' },
      onHintB,
    );

    deliver({ cursor: 3, mailboxId: 'mailbox-a', type: 'mailbox_envelope' });

    expect(onHintA).toHaveBeenCalledTimes(1);
    expect(onHintB).not.toHaveBeenCalled();
  });

  it('subscribes on the live socket as soon as a listener registers', async () => {
    const socket = new SocketDouble();
    connectTo(socket);
    mountRealtime();
    await flushConnections();

    subscribeRealtimeMailboxHints(session, target, jest.fn());

    expect(subscribeMailbox).toHaveBeenCalledWith(
      socket as unknown as WebSocket,
      target,
    );
  });

  it('sends a subscription registered before the socket exists once it is acknowledged', async () => {
    const socket = new SocketDouble();
    connectTo(socket);

    subscribeRealtimeMailboxHints(session, target, jest.fn());
    expect(subscribeMailbox).not.toHaveBeenCalled();

    mountRealtime();
    await flushConnections();
    deliver({ identityId: 'identity-a', type: 'connection_ack' });

    expect(subscribeMailbox).toHaveBeenCalledWith(
      socket as unknown as WebSocket,
      target,
    );
  });

  it('sends every registered subscription again on a reconnected socket', async () => {
    const first = new SocketDouble();
    const second = new SocketDouble();
    connectTo(first, second);
    mountRealtime();
    await flushConnections();
    subscribeRealtimeMailboxHints(session, target, jest.fn());

    first.emit('close');
    jest.advanceTimersByTime(60_000);
    await flushConnections();
    deliver({ identityId: 'identity-a', type: 'connection_ack' });

    expect(subscribeMailbox).toHaveBeenLastCalledWith(
      second as unknown as WebSocket,
      target,
    );
  });

  it('stops delivering hints to a listener once it unsubscribes', async () => {
    connectTo(new SocketDouble());
    mountRealtime();
    await flushConnections();
    const onHint = jest.fn();
    const unsubscribe = subscribeRealtimeMailboxHints(session, target, onHint);

    unsubscribe();
    deliver({ cursor: 4, mailboxId: 'mailbox-a', type: 'mailbox_envelope' });

    expect(onHint).not.toHaveBeenCalled();
  });

  it('forgets every mailbox listener on logout', async () => {
    connectTo(new SocketDouble());
    mountRealtime();
    await flushConnections();
    const onHint = jest.fn();
    subscribeRealtimeMailboxHints(session, target, onHint);

    closeAllRealtimeConnections();
    deliver({ cursor: 5, mailboxId: 'mailbox-a', type: 'mailbox_envelope' });

    expect(onHint).not.toHaveBeenCalled();
  });
});
