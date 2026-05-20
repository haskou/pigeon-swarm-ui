import { UUID } from '@haskou/value-objects';

import type { Session } from '../../domain/pigeonResources.types';

import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { IdentityId } from '../../../modules/identities/domain/value-objects/IdentityId';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { RequestSigner } from '../http/RequestSigner';

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
    }
  | RealtimeTypingMessage;

export type RealtimeTypingMessage =
  | {
      active: boolean;
      conversationId: string;
      identityId: string;
      scope: 'conversation';
      timestamp: number;
      type: 'typing';
    }
  | {
      active: boolean;
      channelId: string;
      communityId: string;
      identityId: string;
      scope: 'community_channel';
      timestamp: number;
      type: 'typing';
    };

export type RealtimeTypingInput =
  | {
      active: boolean;
      conversationId: string;
      scope: 'conversation';
    }
  | {
      active: boolean;
      channelId: string;
      communityId: string;
      scope: 'community_channel';
    };

export type RealtimeHeartbeatActivityMode = 'auto' | 'inactive';

const debugRealtimeStorageKey = 'pigeon:debugRealtime';
const heartbeatIntervalMs = 10000;
const heartbeatTimeoutMs = heartbeatIntervalMs * 3;
const heartbeatTimeoutCloseCode = 4000;
const recentActivityWindowMs = 5 * 60 * 1000;
const activeActivityRefreshMs = 1000;

type ActivityTracker = {
  isActive: () => boolean;
  stop: () => void;
};

export class RealtimeGateway {
  private readonly heartbeatAcks = new WeakMap<WebSocket, number>();

  private readonly heartbeatActivityModes = new Map<
    string,
    RealtimeHeartbeatActivityMode
  >();

  public constructor(
    private readonly urls: ApiUrlBuilder = new ApiUrlBuilder(API_SERVER_URL),
    private readonly signer: RequestSigner = new RequestSigner(),
  ) {}

  public setHeartbeatActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.heartbeatActivityModes.set(session.identity.id, mode);
  }

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
      IdentityId.normalize(session.identity.id),
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
        stopHeartbeat ??= this.startHeartbeat(socket, url, session);
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

  public sendTyping(socket: WebSocket, input: RealtimeTypingInput): void {
    if (socket.readyState !== 1) return;

    socket.send(
      JSON.stringify({
        ...input,
        type: 'typing',
      }),
    );
    this.debug('typing', input);
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

  private startHeartbeat(
    socket: WebSocket,
    url: URL,
    session: Session,
  ): () => void {
    this.ackHeartbeat(socket);
    const activity = this.trackActivity(() => {
      this.sendIdentityHeartbeat(
        socket,
        this.heartbeatActive(session.identity.id, activity),
      );
    });

    const timer = globalThis.setInterval(() => {
      if (Date.now() - this.lastHeartbeatAckAt(socket) >= heartbeatTimeoutMs) {
        this.logError('heartbeat-timeout', url, {
          intervalMs: heartbeatIntervalMs,
          timeoutMs: heartbeatTimeoutMs,
        });
        socket.close(heartbeatTimeoutCloseCode, 'Realtime heartbeat timed out');

        return;
      }

      this.sendIdentityHeartbeat(
        socket,
        this.heartbeatActive(session.identity.id, activity),
      );
    }, heartbeatIntervalMs);

    return () => {
      activity.stop();
      globalThis.clearInterval(timer);
    };
  }

  private heartbeatActive(
    identityId: string,
    activity: ActivityTracker,
  ): boolean {
    return (
      (this.heartbeatActivityModes.get(identityId) ?? 'auto') === 'auto' &&
      activity.isActive()
    );
  }

  private trackActivity(onActiveAgain: () => void): ActivityTracker {
    let lastActivityAt = Date.now();
    const markActive = () => {
      const now = Date.now();
      const wasInactive =
        now - lastActivityAt > recentActivityWindowMs ||
        globalThis.document?.visibilityState === 'hidden';

      if (!wasInactive && now - lastActivityAt < activeActivityRefreshMs) {
        return;
      }

      lastActivityAt = now;

      if (wasInactive) onActiveAgain();
    };
    const movementEvent =
      'PointerEvent' in globalThis ? 'pointermove' : 'mousemove';
    const activityEvents = [
      'focus',
      'keydown',
      'mousedown',
      'pointerdown',
      'scroll',
      'touchstart',
      movementEvent,
    ];

    for (const eventName of activityEvents) {
      globalThis.addEventListener?.(eventName, markActive, {
        passive: true,
      });
    }

    return {
      isActive: () =>
        globalThis.document?.visibilityState !== 'hidden' &&
        Date.now() - lastActivityAt <= recentActivityWindowMs,
      stop: () => {
        for (const eventName of activityEvents) {
          globalThis.removeEventListener?.(eventName, markActive);
        }
      },
    };
  }

  private sendIdentityHeartbeat(socket: WebSocket, active: boolean): void {
    if (socket.readyState !== 1) return;

    socket.send(
      JSON.stringify({
        active,
        type: 'identity_heartbeat',
      }),
    );
    this.debug('heartbeat', 'sent');
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
