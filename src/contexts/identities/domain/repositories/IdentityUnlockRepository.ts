import type { Identity } from '../Identity';
import type { IdentityId } from '../value-objects/IdentityId';
import type { IdentityMasterKeyProtection } from '../value-objects/IdentityMasterKeyProtection';

export interface IdentityUnlockRepository {
  restore(identityId: IdentityId): Promise<Identity>;
  unlock(
    identityId: IdentityId,
    protection: IdentityMasterKeyProtection,
  ): Promise<Identity>;
}
