import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/httpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/requestSigner';
import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../domain/callSession.types';

export class PigeonCallsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async list(session: Session): Promise<CallResource[]> {
    const path = '/calls/';
    const result = await this.http.request<
      { calls?: CallResource[] } | CallResource[]
    >(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return Array.isArray(result) ? result : (result.calls ?? []);
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    const path = `/calls/${encodeURIComponent(callId)}`;

    return await this.http.request<CallResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    const path = '/calls/ice-servers';

    return await this.http.request<CallIceServerConfig>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    const path = '/calls/';
    const body = {
      conversationId,
      scopeType: 'conversation',
    };

    return await this.http.request<CallResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    const path = '/calls/';
    const body = {
      channelId,
      communityId,
      scopeType: 'community_channel',
    };

    return await this.http.request<CallResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    const path = `/calls/${encodeURIComponent(callId)}/participants`;
    const body = {};

    return await this.http.request<CallResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async leave(session: Session, callId: string): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}/participants/me`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async heartbeat(session: Session, callId: string): Promise<void> {
    const path = `/calls/${encodeURIComponent(
      callId,
    )}/participants/me/heartbeat`;
    const body = {};

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async end(session: Session, callId: string): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    const path = `/calls/${encodeURIComponent(callId)}/signals`;
    const body = {
      payload: signal.payload,
      recipientIdentityId: signal.recipientIdentityId,
      signalType: signal.signalType,
    };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }
}
