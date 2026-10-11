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
  applicationContainer: { realtime: { connect: jest.fn() } },
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
