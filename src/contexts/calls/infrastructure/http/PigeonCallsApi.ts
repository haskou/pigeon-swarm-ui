import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { SealedCallSignal } from '../signals/SealedCallSignal';
import type { CallParticipantState } from './CallEventSigner';
import type { CallScopeLookup } from './CallScopeLookup';
import type { CallIceServerResource as CallIceServerConfig } from './resources/CallIceServerResource';
import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from './resources/CallParticipantMediaConnectionResource';
import type { CallResource } from './resources/CallResource';
import type { CallSignalDeliveryResource as CallSignalDelivery } from './resources/CallSignalDeliveryResource';
import type { CallsResource } from './resources/CallsResource';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { pagedPath } from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { CallEventSigner } from './CallEventSigner';
import { CallSignalRequestBody } from './CallSignalRequestBody';

/**
 * A signal POST that never settles would hold its negotiation forever, so
 * the request is aborted and left to `CallSignalRetry` instead.
 */
const signalTimeoutMs = 5_000;

export class PigeonCallsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly events: CallEventSigner,
    private readonly scopes: CallScopeLookup,
  ) {}

  private async nextSessionEpoch(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<number> {
    const live = await this.list(session);
    const epochs = live
      .filter(
        (call) =>
          call.scope.type === 'community_channel' &&
          call.scope.communityId === communityId &&
          call.scope.channelId === channelId,
      )
      // The node serves the epoch of community calls; the UI domain ignores it.
      .map((call) => (call as { sessionEpoch?: number }).sessionEpoch ?? 0);

    return Math.max(0, ...epochs) + 1;
  }

  private async post(
    session: Session,
    path: string,
    body: Record<string, unknown>,
  ): Promise<CallResource> {
    return await this.http.request<CallResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  /**
   * One participant record per call and identity: a stale position answered by
   * the node is re-signed as the successor of what it already stores.
   */
  private async submitParticipant(
    session: Session,
    callId: string,
    state: CallParticipantState,
    at: number,
    send: (mutation: PublicMutation) => Promise<void>,
  ): Promise<void> {
    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.events.participant(session, callId, state, at, position),
      send,
    );
  }

  public async list(session: Session): Promise<CallResource[]> {
    const path = '/calls';
    const pages = await readAllPages<CallsResource>(async (cursor) => {
      const target = pagedPath(path, cursor);

      return await this.http.request<CallsResource>(target, {
        headers: await this.signer.headers(session, 'GET', target),
        method: 'GET',
      });
    });

    return pages.flatMap((page) => page.calls);
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    const path = `/calls/${encodeURIComponent(callId)}`;

    return await this.http.request<CallResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    const path = '/call-ice-servers';

    return await this.http.request<CallIceServerConfig>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async startConversation(
    session: Session,
    conversationId: string,
    startedAt: number,
  ): Promise<CallResource> {
    const conversation = await this.scopes.conversation(
      session,
      conversationId,
    );
    const nonce = this.events.nonce();
    const start = await this.events.start(session, {
      networkId: conversation.networkId,
      nonce,
      participantIds: conversation.participantIds,
      scope: { conversationId, type: 'conversation' },
      startedAt,
    });

    return await this.post(session, '/calls', {
      conversationId,
      mutation: start.mutation,
      nonce,
      scopeType: 'conversation',
      startedAt,
    });
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    startedAt: number,
  ): Promise<CallResource> {
    const networkId = await this.scopes.communityNetworkId(
      session,
      communityId,
    );
    const nonce = this.events.nonce();
    const sessionEpoch = await this.nextSessionEpoch(
      session,
      communityId,
      channelId,
    );
    const start = await this.events.start(session, {
      networkId,
      nonce,
      participantIds: [],
      scope: { channelId, communityId, type: 'community_channel' },
      sessionEpoch,
      startedAt,
    });
    const call = await this.post(session, '/calls', {
      channelId,
      communityId,
      mutation: start.mutation,
      nonce,
      scopeType: 'community_channel',
      sessionEpoch,
      startedAt,
    });

    // The node answers with the channel's live call and stores no start when
    // one exists; this client then joins it with a signed participant state.
    return call.id === start.callId
      ? call
      : await this.join(session, call.id, startedAt);
  }

  public async join(
    session: Session,
    callId: string,
    at: number,
  ): Promise<CallResource> {
    const path = `/calls/${encodeURIComponent(callId)}/participants`;
    let call: CallResource | undefined;

    await this.submitParticipant(
      session,
      callId,
      'joined',
      at,
      async (mutation) => {
        const body = { at, mutation };

        call = await this.http.request<CallResource>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, 'POST', path, body),
          method: 'POST',
        });
      },
    );

    return call as CallResource;
  }

  public async leave(
    session: Session,
    callId: string,
    at: number,
    declined: boolean,
  ): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}/participants/me`;

    await this.submitParticipant(
      session,
      callId,
      declined ? 'declined' : 'left',
      at,
      async (mutation) => {
        const body = { at, mutation };

        await this.http.request(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, 'DELETE', path, body),
          keepalive: true,
          method: 'DELETE',
        });
      },
    );
  }

  public async heartbeat(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}/participants/me`;
    const body = { mediaConnections };

    await this.http.request<void>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async end(
    session: Session,
    callId: string,
    at: number,
  ): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}`;
    const body = { at, mutation: await this.events.end(session, callId, at) };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: SealedCallSignal,
  ): Promise<CallSignalDelivery> {
    const path = `/calls/${encodeURIComponent(callId)}/signals`;
    const requestBody = new CallSignalRequestBody(signal);
    const body = requestBody.body();
    const headers = await this.signer.headers(session, 'POST', path, body);
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new DOMException('Call signal timed out.', 'TimeoutError'),
        ),
      signalTimeoutMs,
    );

    try {
      return await this.http.request<CallSignalDelivery>(path, {
        body: requestBody.toString(),
        headers,
        method: 'POST',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
