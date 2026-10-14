import type { Timestamp } from '@haskou/value-objects';

import type { ContactPresence } from '../ContactPresence';
import type { ContactPresenceBoard } from '../ContactPresenceBoard';
import type { ContactPresenceBroadcast } from '../ContactPresenceBroadcast';
import type { PresenceSharing } from '../PresenceSharing';
import type { IdentityId } from '../value-objects/IdentityId';

/**
 * End-to-end presence between a local identity and the contacts it shares
 * with. The board and the broadcast live for the app session.
 */
export interface ContactPresenceRepository {
  board(actorIdentityId: IdentityId): ContactPresenceBoard;
  broadcast(actorIdentityId: IdentityId): ContactPresenceBroadcast;
  /** Stops receiving from the contact; never rejects. */
  close(actorIdentityId: IdentityId, sharing: PresenceSharing): Promise<void>;
  /** Never rejects: an update that does not land simply expires. */
  publish(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
    presence: ContactPresence,
  ): Promise<void>;
  /**
   * The updates the contact sent since the last read. Clears from the relay
   * what expired by `receivedAt`; never rejects.
   */
  receive(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
    receivedAt: Timestamp,
  ): Promise<ContactPresence[]>;
}
