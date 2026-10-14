import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../session/Session';
import type { IdentityPresenceResource as IdentityPresence } from './resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from './resources/SelectablePresenceStatusResource';

export class PigeonPresenceApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async get(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    const path = `/presence/${encodeURIComponent(identityId)}`;
    const body = {};

    return await this.http.request<IdentityPresence>(path, {
      headers: await this.signer.headers(session, 'GET', path, body),
      method: 'GET',
    });
  }

  public async update(
    session: Session,
    input: { status: SelectablePresenceStatus },
  ): Promise<IdentityPresence> {
    const path = '/presence/me';
    const body = {
      status: input.status,
    };

    return await this.http.request<IdentityPresence>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }
}
