import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { CachedIdentity } from './CachedIdentity';

import { IdentityId } from '../../domain/value-objects/IdentityId';

const identityCacheTtlMs = 2 * 60 * 1000;

export class PigeonIdentityGateway {
  private readonly cache = new Map<string, CachedIdentity>();

  private readonly pendingRequests = new Map<
    string,
    Promise<IdentityResource>
  >();

  public constructor(private readonly http: HttpJsonClient) {}

  public async get(identityId: string): Promise<IdentityResource> {
    const normalizedIdentityId = IdentityId.normalize(identityId);
    const cached = this.cache.get(normalizedIdentityId);

    if (cached && Date.now() < cached.expiresAt) return cached.identity;

    return await this.refresh(normalizedIdentityId);
  }

  public remember(identity: IdentityResource, lookupIdentityId?: string): void {
    const entry = {
      expiresAt: Date.now() + identityCacheTtlMs,
      identity,
    };

    this.cache.set(IdentityId.normalize(identity.id), entry);

    if (lookupIdentityId) {
      this.cache.set(IdentityId.normalize(lookupIdentityId), entry);
    }
  }

  public async refresh(identityId: string): Promise<IdentityResource> {
    const normalizedIdentityId = IdentityId.normalize(identityId);
    const pending = this.pendingRequests.get(normalizedIdentityId);

    if (pending) return await pending;

    const request = this.http
      .request<IdentityResource>(
        `/identities/${encodeURIComponent(normalizedIdentityId)}`,
      )
      .then((identity) => {
        this.remember(identity, normalizedIdentityId);

        return identity;
      })
      .finally(() => {
        this.pendingRequests.delete(normalizedIdentityId);
      });

    this.pendingRequests.set(normalizedIdentityId, request);

    return await request;
  }
}
