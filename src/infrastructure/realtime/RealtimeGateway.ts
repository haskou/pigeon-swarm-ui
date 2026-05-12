import type { Session } from '../../domain/types';

import { API_SERVER_URL } from '../../config';
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
      event: RealtimeDomainEvent;
      type: 'domain_event';
    };

const debugRealtimeStorageKey = 'pigeon:debugRealtime';

export class RealtimeGateway {
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
    const nonce = crypto.randomUUID();
    const signature = await session.encryptedKeyPair.sign(
      this.signer.payload('GET', path, timestamp, nonce, {}),
      session.password,
    );
    const url = this.url('/ws');

    url.searchParams.set('identityId', session.identity.id);
    url.searchParams.set('timestamp', timestamp);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('signature', signature.toString());

    const socket = new WebSocket(url.toString());

    socket.addEventListener('message', (event) => {
      this.debug('message', event.data);
      const message = this.parseMessage(event.data);

      if (message) onMessage(message);
    });
    socket.addEventListener('open', () => this.debug('open', url.pathname));
    socket.addEventListener('close', (event) =>
      this.debug('close', `${event.code} ${event.reason}`.trim()),
    );
    socket.addEventListener('error', () => this.debug('error', url.pathname));

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
    return new URL(this.urls.build(path)).pathname;
  }

  private url(path: string): URL {
    const url = new URL(this.urls.build(path));

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url;
  }

  private debug(event: string, data: unknown): void {
    if (globalThis.localStorage?.getItem(debugRealtimeStorageKey) !== '1') {
      return;
    }

    console.debug(`[pigeon:realtime:${event}]`, data);
  }
}
