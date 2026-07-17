import type { IdentityPresence } from '../IdentityPresence';
import type { IdentityId } from '../value-objects/IdentityId';

export interface IdentityPresenceRepository {
  find(
    identityId: IdentityId,
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence>;
  search(
    identityIds: IdentityId[],
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence[]>;
  update(
    presence: IdentityPresence,
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence>;
}
