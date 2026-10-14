import type { IdentityId } from '../value-objects/IdentityId';

/** The contact directory this device keeps for one identity. */
export interface ContactDirectoryRepository {
  forget(identityId: IdentityId): Promise<void>;
}
