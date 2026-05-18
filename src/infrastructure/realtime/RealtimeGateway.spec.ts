import type { Session } from '../../domain/types';

import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { RequestSigner } from '../pigeon-api/RequestSigner';
import { RealtimeGateway } from './RealtimeGateway';

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

const nonce = '00000000-0000-4000-8000-000000000001';

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
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const signer = new RequestSigner();
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'socket-signature',
    });
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity+with/slash=' },
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
    const queryNonce = url.searchParams.get('nonce');

    expect(queryNonce).toBe(nonce);
    expect(url.searchParams.get('signature')).toBe('socket-signature');
    expect(sign).toHaveBeenCalledWith(
      signer.payload('GET', '/api/ws', '1778536870557', nonce, {}),
      'secret',
    );
  });

  it('resolves relative websocket URLs against the current origin', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('/api'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;

    await gateway.connect(session, jest.fn());

    const url = new URL(WebSocketMock.instances[0]?.url ?? '');

    expect(url.pathname).toBe('/api/ws');
    expect(['ws:', 'wss:']).toContain(url.protocol);
  });

  it('logs websocket errors without leaking the signature', async () => {
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('https://example.com/api'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
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
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
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

  it('starts identity heartbeats after the connection acknowledgement', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
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

  it('closes the socket when heartbeat acknowledgements stop', async () => {
    jest.useFakeTimers();
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
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
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);
    const gateway = new RealtimeGateway(
      new ApiUrlBuilder('http://localhost:8080/'),
      new RequestSigner(),
    );
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
      },
      identity: { id: 'identity-1' },
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
