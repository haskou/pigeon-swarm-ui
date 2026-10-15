import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from './HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

/**
 * Reads the causal frontier of a community. A record scoped to one signs it,
 * so the node judges the author's permission at exactly the state the author
 * had observed.
 */
export class ScopeFrontierReader {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async community(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/frontier`;
    const result = await this.http.request<{ frontier: string[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.frontier;
  }
}
