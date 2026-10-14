import type { PresenceSharing } from '../PresenceSharing';
import type { IdentityId } from '../value-objects/IdentityId';

/** The contacts this device exchanges presence with, per local identity. */
export interface PresenceSharingRepository {
  delete(actorIdentityId: IdentityId, sharing: PresenceSharing): Promise<void>;
  save(actorIdentityId: IdentityId, sharing: PresenceSharing): Promise<void>;
  search(actorIdentityId: IdentityId): Promise<PresenceSharing[]>;
}
