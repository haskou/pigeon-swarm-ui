import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import { RealtimeGateway } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

class WebSocketMock {
  public static instances: WebSocketMock[] = [];

  public readonly close = jest.fn<void, [number?, string?]>(
    (code = 1000, reason = '') => {
      this.emitClose(code, reason, code === 1000);
    },
  );

  public readonly listeners = new Map<string, Array<(event: Event) => void>>();

  public readonly send = jest.fn();

  public readonly readyState = 1;

  public constructor(public readonly url: string) {
    WebSocketMock.instances.push(this);
  }

  public addEventListener(
    type: string,
    listener: (event: Event) => void,
  ): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  public emitMessage(data: string): void {
    this.listeners
      .get('message')
      ?.forEach((listener) => listener({ data } as MessageEvent));
  }

  public emitError(): void {
    this.listeners
      .get('error')
      ?.forEach((listener) => listener({ type: 'error' } as Event));
  }

  public emitClose(code = 1000, reason = '', wasClean = true): void {
    this.listeners.get('close')?.forEach((listener) =>
      listener({
        code,
        reason,
        type: 'close',
        wasClean,
      } as CloseEvent),
    );
  }
}

describe(RealtimeGateway.name, () => {
  const originalWebSocket = global.WebSocket;

  afterEach(() => {
    WebSocketMock.instances.forEach((socket) => {
      socket.emitClose();
    });
    jest.restoreAllMocks();
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
    WebSocketMock.instances = [];
  });

  it('opens a signed websocket using query authentication', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(Date, 'now').mockReturnValue(1778536870557);
    const signer = new RequestSigner();
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'socket-signature',
    });
    const session = {
      identity: { id: 'identity+with/slash=' },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/api/'),
      signer,
    );
    const onMessage = jest.fn();

    await gateway.connect(session, onMessage);

    const url = new URL(WebSocketMock.instances[0]?.url ?? '');

    expect(url.protocol).toBe('ws:');
    expect(url.origin).toBe('ws://localhost:8080');
    expect(url.pathname).toBe('/api/ws');
    expect(url.searchParams.get('identityId')).toBe('identity+with/slash=');
    expect(url.searchParams.get('timestamp')).toBe('1778536870557');

    expect(url.searchParams.has('nonce')).toBe(false);
    expect(url.searchParams.get('signature')).toBe('socket-signature');
    expect(sign).toHaveBeenCalledWith(
      signer.payload('GET', '/api/ws', 1778536870557, {}),
    );
    expect(
      JSON.parse((sign.mock.calls[0] as [string])[0]) as {
        timestamp: unknown;
      },
    ).toMatchObject({
      path: '/api/ws',
      timestamp: 1778536870557,
    });
  });

  it('resolves relative websocket URLs against the current origin', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('/api'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());

    const url = new URL(WebSocketMock.instances[0]?.url ?? '');

    expect(url.pathname).toBe('/api/ws');
    expect(['ws:', 'wss:']).toContain(url.protocol);
  });

  it('logs websocket errors without leaking the signature', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('https://example.com/api'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitError();

    expect(consoleError).toHaveBeenCalledWith(
      '[pigeon realtime] websocket',
      'error',
      expect.objectContaining({
        url: expect.not.stringContaining('signature='),
      }),
    );
  });

  it('parses realtime messages from the socket', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;
    const onMessage = jest.fn();

    await gateway.connect(session, onMessage);
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      identityId: 'identity-1',
      type: 'connection_ack',
    });
  });

  it('forwards live network synchronization snapshots', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;
    const onMessage = jest.fn();
    const status = {
      changedAt: 1_770_000_000_000,
      networks: [
        {
          connectedPeerIds: ['peer-1'],
          convergedStoreCount: 2,
          id: 'network-1',
          name: 'Alpha network',
          replicationPeerIds: ['peer-1'],
          state: 'converged',
          stores: [],
          totalStoreCount: 2,
          type: 'private',
        },
      ],
    };

    await gateway.connect(session, onMessage);
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({ status, type: 'network_synchronization_status' }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      status,
      type: 'network_synchronization_status',
    });
  });

  it('parses typing messages from the socket', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;
    const onMessage = jest.fn();

    await gateway.connect(session, onMessage);
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        active: true,
        conversationId: 'conversation-1',
        identityId: 'identity-2',
        scope: 'conversation',
        timestamp: 1770000000000,
        type: 'typing',
      }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      active: true,
      conversationId: 'conversation-1',
      identityId: 'identity-2',
      scope: 'conversation',
      timestamp: 1770000000000,
      type: 'typing',
    });
  });

  it('sends typing messages through an open socket', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    const socket = await gateway.connect(session, jest.fn());

    gateway.sendTyping(socket, {
      active: true,
      channelId: 'channel-1',
      communityId: 'community-1',
      scope: 'community_channel',
    });

    expect(WebSocketMock.instances[0]?.send).toHaveBeenCalledWith(
      JSON.stringify({
        active: true,
        channelId: 'channel-1',
        communityId: 'community-1',
        scope: 'community_channel',
        type: 'typing',
      }),
    );
  });

  it('starts identity heartbeats after the connection acknowledgement', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );

    jest.advanceTimersByTime(9999);
    expect(WebSocketMock.instances[0]?.send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(WebSocketMock.instances[0]?.send).toHaveBeenCalledWith(
      JSON.stringify({ active: true, type: 'identity_heartbeat' }),
    );
  });

  it('marks identity heartbeats inactive after five minutes without user activity', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1778536870557);
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );

    for (let heartbeat = 0; heartbeat < 31; heartbeat += 1) {
      jest.advanceTimersByTime(10000);
      WebSocketMock.instances[0]?.emitMessage(
        JSON.stringify({
          identityId: 'identity-1',
          timestamp: Date.now(),
          type: 'heartbeat_ack',
        }),
      );
    }

    expect(WebSocketMock.instances[0]?.send).toHaveBeenLastCalledWith(
      JSON.stringify({ active: false, type: 'identity_heartbeat' }),
    );
  });

  it('sends an active heartbeat when the user returns from idle', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1778536870557);
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const activityListeners: EventListener[] = [];
    const globalEvents = globalThis as unknown as {
      addEventListener?: (
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions,
      ) => void;
      removeEventListener?: (type: string, listener: EventListener) => void;
    };
    const originalAddEventListener = globalEvents.addEventListener;
    const originalRemoveEventListener = globalEvents.removeEventListener;

    globalEvents.addEventListener = (type, listener) => {
      if (type === 'mousemove') activityListeners.push(listener);
    };
    globalEvents.removeEventListener = (type, listener) => {
      if (type !== 'mousemove') return;

      const index = activityListeners.indexOf(listener);

      if (index >= 0) activityListeners.splice(index, 1);
    };
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );

    for (let heartbeat = 0; heartbeat < 31; heartbeat += 1) {
      jest.advanceTimersByTime(10000);
      WebSocketMock.instances[0]?.emitMessage(
        JSON.stringify({
          identityId: 'identity-1',
          timestamp: Date.now(),
          type: 'heartbeat_ack',
        }),
      );
    }

    activityListeners.forEach((listener) => listener(new Event('mousemove')));

    expect(WebSocketMock.instances[0]?.send).toHaveBeenLastCalledWith(
      JSON.stringify({ active: true, type: 'identity_heartbeat' }),
    );
    globalEvents.addEventListener = originalAddEventListener;
    globalEvents.removeEventListener = originalRemoveEventListener;
  });

  it('keeps identity heartbeats inactive when presence activity is disabled', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    gateway.setHeartbeatActivityMode(session, 'inactive');
    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );
    jest.advanceTimersByTime(10000);

    expect(WebSocketMock.instances[0]?.send).toHaveBeenLastCalledWith(
      JSON.stringify({ active: false, type: 'identity_heartbeat' }),
    );
  });

  it('closes the socket when heartbeat acknowledgements stop', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );

    jest.advanceTimersByTime(30000);

    expect(WebSocketMock.instances[0]?.close).toHaveBeenCalledWith(
      4000,
      'Realtime heartbeat timed out',
    );
  });

  it('keeps the socket open when heartbeat acknowledgements arrive', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      identity: { id: 'identity-1' },
      keyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        type: 'connection_ack',
      }),
    );
    jest.advanceTimersByTime(10000);
    WebSocketMock.instances[0]?.emitMessage(
      JSON.stringify({
        identityId: 'identity-1',
        timestamp: 1770000000000,
        type: 'heartbeat_ack',
      }),
    );
    jest.advanceTimersByTime(10000);

    expect(WebSocketMock.instances[0]?.close).not.toHaveBeenCalled();
  });
});
