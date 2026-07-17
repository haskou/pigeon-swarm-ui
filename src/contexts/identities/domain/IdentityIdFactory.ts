import type { IdentityId } from './value-objects/IdentityId';

export interface IdentityIdFactory {
  create(): Promise<IdentityId>;
}
