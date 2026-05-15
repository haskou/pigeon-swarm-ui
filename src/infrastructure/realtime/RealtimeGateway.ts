import { UUID } from '@haskou/value-objects';

import type { Session } from '../../domain/types';

import { API_SERVER_URL } from '../../config';
import { normalizeIdentityId } from '../../utils/identityId';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { RequestSigner } from '../pigeon-api/RequestSigner';

export type RealtimeDomainEvent = {
  aggregate_id: string;
  attributes: Record<string, unknown>;
  causation_id: string;
  correlation_id: string;
  event_id: string;
  occurred_on: number;
  type: string;
};

export type RealtimeMessage =
  | {
      identityId: string;
      type: 'connection_ack';
    }
  | {
      identityId: string;
      timestamp: number;
      type: 'heartbeat_ack';
    }
  | {
      event: RealtimeDomainEvent;
      type: 'domain_event';
    };

const debugRealtimeStorageKey = 'pigeon:debugRealtime';
const heartbeatIntervalMs = 30000;
const heartbeatTimeoutMs = heartbeatIntervalMs * 2;
const heartbeatTimeoutCloseCode = 4000;

export class RealtimeGateway {
  private readonly heartbeatAcks = new WeakMap<WebSocket, number>();

  public constructor(
    private readonly urls: ApiUrlBuilder = new ApiUrlBuilder(API_SERVER_URL),
    private readonly signer: RequestSigner = new RequestSigner(),
  ) {}

  public async connect(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    const path = this.path('/ws');
    const timestamp = `${Date.now()}`;
    const nonce = UUID.generate().toString();
    const signature = await session.encryptedKeyPair.sign(
      this.signer.payload('GET', path, timestamp, nonce, {}),
      session.password,
    );
    const url = this.url('/ws');

    url.searchParams.set(
      'identityId',
      normalizeIdentityId(session.identity.id),
    );
    url.searchParams.set('timestamp', timestamp);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('signature', signature.toString());

    let socket: WebSocket;

    try {
      socket = new WebSocket(url.toString());
    } catch (caught) {
      this.logError('constructor', url, caught);

      throw caught;
    }

    let stopHeartbeat: (() => void) | undefined;

    socket.addEventListener('message', (event) => {
      this.debug('message', event.data);
      const message = this.parseMessage(event.data);

      if (message?.type === 'connection_ack') {
        stopHeartbeat ??= this.startHeartbeat(socket, url);
      }

      if (message?.type === 'heartbeat_ack') {
        this.ackHeartbeat(socket);
      }

      if (message) onMessage(message);
    });
    socket.addEventListener('open', () => this.debug('open', url.pathname));
    socket.addEventListener('close', (event) => {
      stopHeartbeat?.();
      this.debug('close', `${event.code} ${event.reason}`.trim());

      if (event.code !== 1000) {
        this.logError('close', url, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
      }
    });
    socket.addEventListener('error', (event) => {
      this.debug('error', url.pathname);
      this.logError('error', url, {
        type: event.type,
      });
    });

    return socket;
  }

  private parseMessage(data: unknown): RealtimeMessage | null {
    if (typeof data !== 'string') return null;

    try {
      const parsed = JSON.parse(data) as RealtimeMessage;

      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private path(path: string): string {
    return this.url(path).pathname;
  }

  private startHeartbeat(socket: WebSocket, url: URL): () => void {
    this.ackHeartbeat(socket);

    const timer = globalThis.setInterval(() => {
      if (Date.now() - this.lastHeartbeatAckAt(socket) >= heartbeatTimeoutMs) {
        this.logError('heartbeat-timeout', url, {
          intervalMs: heartbeatIntervalMs,
          timeoutMs: heartbeatTimeoutMs,
        });
        socket.close(heartbeatTimeoutCloseCode, 'Realtime heartbeat timed out');

        return;
      }

      if (socket.readyState !== 1) return;

      socket.send(JSON.stringify({ type: 'identity_heartbeat' }));
      this.debug('heartbeat', 'sent');
    }, heartbeatIntervalMs);

    return () => globalThis.clearInterval(timer);
  }

  private ackHeartbeat(socket: WebSocket): void {
    this.heartbeatAcks.set(socket, Date.now());
  }

  private lastHeartbeatAckAt(socket: WebSocket): number {
    return this.heartbeatAcks.get(socket) ?? 0;
  }

  private url(path: string): URL {
    const url = new URL(this.urls.build(path), this.currentOrigin());

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url;
  }

  private currentOrigin(): string {
    return globalThis.location?.origin ?? 'http://localhost';
  }

  private logError(event: string, url: URL, data: unknown): void {
    const safeUrl = new URL(url.toString());

    safeUrl.searchParams.delete('signature');

    // eslint-disable-next-line no-console
    console.error('[pigeon realtime] websocket', event, {
      data,
      url: safeUrl.toString(),
    });
  }

  private debug(event: string, data: unknown): void {
    if (globalThis.localStorage?.getItem(debugRealtimeStorageKey) !== '1') {
      return;
    }

    globalThis.dispatchEvent(
      new CustomEvent('pigeon:realtime-debug', {
        detail: { data, event },
      }),
    );
  }
}
