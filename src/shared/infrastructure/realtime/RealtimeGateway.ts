import type { RealtimeMessage } from './RealtimeMessage';
import type { RealtimeTypingInput } from './RealtimeTypingInput';

export type { RealtimeDomainEvent } from './RealtimeDomainEvent';
export type { RealtimeMessage } from './RealtimeMessage';
export type { RealtimeTypingMessage } from './RealtimeTypingMessage';
export type { RealtimeTypingInput } from './RealtimeTypingInput';
import type { Session } from '../../domain/pigeonResources.types';

import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { signSessionPayload } from '../crypto/signSessionPayload';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { RequestSigner } from '../http/RequestSigner';
import { RealtimeCallSignalAcknowledgementPublisher } from './RealtimeCallSignalAcknowledgementPublisher';
import { RealtimeConnectionUrl } from './RealtimeConnectionUrl';
import {
  RealtimeHeartbeat,
  type RealtimeHeartbeatActivityMode,
} from './RealtimeHeartbeat';
import { RealtimeMessageParser } from './RealtimeMessageParser';
import { RealtimeTypingPublisher } from './RealtimeTypingPublisher';

export type { RealtimeHeartbeatActivityMode } from './RealtimeHeartbeat';

const debugRealtimeStorageKey = 'pigeon:debugRealtime';

export class RealtimeGateway {
  private readonly connection: RealtimeConnectionUrl;

  private readonly heartbeat = new RealtimeHeartbeat();

  private readonly callSignalAcknowledgements =
    new RealtimeCallSignalAcknowledgementPublisher();

  private readonly parser = new RealtimeMessageParser();

  private readonly typing = new RealtimeTypingPublisher();

  public constructor(
    urls: ApiUrlBuilder = new ApiUrlBuilder(API_SERVER_URL),
    private readonly signer: RequestSigner = new RequestSigner(),
  ) {
    this.connection = new RealtimeConnectionUrl(urls);
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
    const timestamp = Date.now();
    const url = this.connection.websocket('/ws');
    const signature = await signSessionPayload(
      session,
      this.signer.payload('GET', url.pathname, timestamp, {}),
    );

    url.searchParams.set(
      'identityId',
      IdentityId.normalize(session.identity.id),
    );
    url.searchParams.set('timestamp', `${timestamp}`);
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

  public acknowledgeCallSignal(socket: WebSocket, signalId: string): void {
    this.callSignalAcknowledgements.send(socket, signalId, (event, data) =>
      this.debug(event, data),
    );
  }
}
