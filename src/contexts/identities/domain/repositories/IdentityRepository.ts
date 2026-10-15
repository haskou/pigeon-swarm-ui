import type { Identity } from '../Identity';
import type { IdentityId } from '../value-objects/IdentityId';
import type { IdentityMasterKeyProtection } from '../value-objects/IdentityMasterKeyProtection';
import type { IdentityRegistrationCode } from '../value-objects/IdentityRegistrationCode';

export interface IdentityRepository {
  create(
    identity: Identity,
    protection: IdentityMasterKeyProtection,
    registrationCode: IdentityRegistrationCode | null,
  ): Promise<Identity>;
  find(identityId: IdentityId): Promise<Identity>;
  refresh(identityId: IdentityId): Promise<Identity>;
  update(identity: Identity, actorIdentityId: IdentityId): Promise<Identity>;
}
