import type {
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

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

  public async getMany(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    const path = '/presence/';
    const query = new URLSearchParams();
    const body = {};

    for (const identityId of uniqueSorted(identityIds)) {
      query.append('identityIds', identityId);
    }

    const result = await this.http.request<
      IdentityPresence[] | { presences: IdentityPresence[] }
    >(`${path}?${query.toString()}`, {
      headers: await this.signer.headers(session, 'GET', path, body),
      method: 'GET',
    });

    return Array.isArray(result) ? result : result.presences;
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
