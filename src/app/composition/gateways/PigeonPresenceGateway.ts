import type {
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CachedRequestOptions } from '../PigeonApiGateway/CachedRequestOptions';

import { PigeonPresenceApi } from '../../../contexts/identities/infrastructure/http/PigeonPresenceApi';
import { PigeonRequestCache } from '../PigeonApiGateway/PigeonRequestCache';

const presenceCacheTtlMs = 1500;

export class PigeonPresenceGateway {
  public constructor(
    private readonly presence: PigeonPresenceApi,
    private readonly requestCache: PigeonRequestCache,
  ) {}

  public async get(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async getMany(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    const uniqueIdentityIds = [...new Set(identityIds.filter(Boolean))].sort();
    const key = `GET /presence/ ${session.identity.id} ${uniqueIdentityIds.join('\u0000')}`;
    const options: CachedRequestOptions = { ttlMs: presenceCacheTtlMs };

    return await this.requestCache.load(
      key,
      () => this.presence.getMany(session, uniqueIdentityIds),
      options,
    );
  }

  public async update(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, { status });
  }
}
