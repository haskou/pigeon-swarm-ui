import type { IdentityResource } from './resources/IdentityResource';

export type CachedIdentity = {
  expiresAt: number;
  identity: IdentityResource;
};
