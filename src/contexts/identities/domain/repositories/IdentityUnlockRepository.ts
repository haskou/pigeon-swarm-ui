import type { Identity } from '../Identity';
import type { IdentityId } from '../value-objects/IdentityId';
import type { IdentityMasterKeyProtection } from '../value-objects/IdentityMasterKeyProtection';

export interface IdentityUnlockRepository {
  forget(identityId: IdentityId): Promise<void>;
  unlock(
    identityId: IdentityId,
    protection: IdentityMasterKeyProtection,
  ): Promise<Identity>;
}
