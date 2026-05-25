import type { Session } from '../../domain/pigeonResources.types';

import { RealtimeHeartbeat } from './RealtimeHeartbeat';

type Listener = () => void;

function restoreGlobalProperty(
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

function session(): Session {
  return {
    identity: {
      id: 'identity-1',
    },
  } as Session;
}

describe(RealtimeHeartbeat.name, () => {
  const originalAddEventListener = Object.getOwnPropertyDescriptor(
    globalThis,
    'addEventListener',
  );
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const originalRemoveEventListener = Object.getOwnPropertyDescriptor(
    globalThis,
    'removeEventListener',
  );
  let documentListeners: Record<string, Listener[]> = {};
  let visibilityState: DocumentVisibilityState = 'visible';
  let windowListeners: Record<string, Listener[]> = {};

  beforeEach(() => {
    jest.useFakeTimers();
    documentListeners = {};
    windowListeners = {};
    visibilityState = 'visible';
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: (eventName: string, listener: Listener) => {
        windowListeners[eventName] = [
          ...(windowListeners[eventName] ?? []),
          listener,
        ];
      },
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: (eventName: string, listener: Listener) => {
        windowListeners[eventName] = (windowListeners[eventName] ?? []).filter(
          (item) => item !== listener,
        );
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        addEventListener: (eventName: string, listener: Listener) => {
          documentListeners[eventName] = [
            ...(documentListeners[eventName] ?? []),
            listener,
          ];
        },
        get visibilityState() {
          return visibilityState;
        },
        removeEventListener: (eventName: string, listener: Listener) => {
          documentListeners[eventName] = (
            documentListeners[eventName] ?? []
          ).filter((item) => item !== listener);
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreGlobalProperty('addEventListener', originalAddEventListener);
    restoreGlobalProperty('document', originalDocument);
    restoreGlobalProperty('removeEventListener', originalRemoveEventListener);
  });

  it('sends inactive and active heartbeats when browser visibility changes', () => {
    const activeStates: boolean[] = [];
    const heartbeat = new RealtimeHeartbeat();
    const stop = heartbeat.start(
      { close: jest.fn() } as unknown as WebSocket,
      session(),
      (active) => activeStates.push(active),
      jest.fn(),
    );

    visibilityState = 'hidden';
    documentListeners.visibilitychange?.forEach((listener) => listener());
    visibilityState = 'visible';
    documentListeners.visibilitychange?.forEach((listener) => listener());
    stop();
    visibilityState = 'hidden';
    documentListeners.visibilitychange?.forEach((listener) => listener());

    expect(activeStates).toEqual([false, true]);
  });

  it('sends inactive and active heartbeats when the page is hidden and restored', () => {
    const activeStates: boolean[] = [];
    const heartbeat = new RealtimeHeartbeat();
    const stop = heartbeat.start(
      { close: jest.fn() } as unknown as WebSocket,
      session(),
      (active) => activeStates.push(active),
      jest.fn(),
    );

    windowListeners.pagehide?.forEach((listener) => listener());
    windowListeners.pageshow?.forEach((listener) => listener());
    stop();

    expect(activeStates).toEqual([false, true]);
  });
});
