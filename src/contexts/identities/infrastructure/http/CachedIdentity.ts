import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export type CachedIdentity = {
  expiresAt: number;
  identity: IdentityResource;
};
