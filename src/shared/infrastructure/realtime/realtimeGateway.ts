import { UUID } from '@haskou/value-objects';

import type { Session } from '../../domain/pigeonResources.types';

import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { RequestSigner } from '../http/RequestSigner';
import { RealtimeConnectionUrl } from './RealtimeConnectionUrl';
import {
  RealtimeHeartbeat,
  type RealtimeHeartbeatActivityMode,
} from './RealtimeHeartbeat';
import { RealtimeMessageParser } from './RealtimeMessageParser';
import { RealtimeTypingPublisher } from './RealtimeTypingPublisher';

export type { RealtimeHeartbeatActivityMode } from './RealtimeHeartbeat';

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

const debugRealtimeStorageKey = 'pigeon:debugRealtime';

export class RealtimeGateway {
  private readonly connection: RealtimeConnectionUrl;

  private readonly heartbeat = new RealtimeHeartbeat();

  private readonly parser = new RealtimeMessageParser();

  private readonly typing = new RealtimeTypingPublisher();

  public constructor(
    urls: ApiUrlBuilder = new ApiUrlBuilder(API_SERVER_URL),
    private readonly signer: RequestSigner = new RequestSigner(),
  ) {
    this.connection = new RealtimeConnectionUrl(urls);
  }

  public setHeartbeatActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.heartbeat.setActivityMode(session, mode);
  }

  public async connect(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    const path = this.connection.path('/ws');
    const timestamp = `${Date.now()}`;
    const nonce = UUID.generate().toString();
    const signature = await session.encryptedKeyPair.sign(
      this.signer.payload('GET', path, timestamp, nonce, {}),
      session.password,
    );
    const url = this.connection.websocket('/ws');

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
      const message = this.parser.parse(event.data);

      if (message?.type === 'connection_ack') {
        stopHeartbeat ??= this.heartbeat.start(
          socket,
          session,
          (active) => this.sendIdentityHeartbeat(socket, active),
          (data) => this.logError('heartbeat-timeout', url, data),
        );
      }

      if (message?.type === 'heartbeat_ack') {
        this.heartbeat.acknowledge(socket);
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
    this.typing.send(socket, input, (event, data) => this.debug(event, data));
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
