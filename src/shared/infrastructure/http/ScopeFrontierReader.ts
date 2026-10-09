import type { Session } from '../../domain/pigeonResources.types';
import type { HttpJsonClient } from './HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

/**
 * Reads the causal frontier of a community or conversation. A record scoped to
 * one signs it, so the node judges the author's permission at exactly the
 * state the author had observed.
 */
export class ScopeFrontierReader {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  private async read(session: Session, path: string): Promise<string[]> {
    const result = await this.http.request<{ frontier: string[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.frontier;
  }

  public async community(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.read(
      session,
      `/communities/${encodeURIComponent(communityId)}/frontier`,
    );
  }

  public async conversation(
    session: Session,
    conversationId: string,
  ): Promise<string[]> {
    return await this.read(
      session,
      `/conversations/${encodeURIComponent(conversationId)}/frontier`,
    );
  }

  /** Scope of a record payload: its conversation or its community. */
  public async ofPayload(
    session: Session,
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    return typeof payload.conversationId === 'string'
      ? await this.conversation(session, payload.conversationId)
      : await this.community(session, String(payload.communityId));
  }
}
