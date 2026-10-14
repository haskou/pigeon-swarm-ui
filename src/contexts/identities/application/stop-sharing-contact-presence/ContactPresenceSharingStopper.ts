import type { ContactPresenceRepository } from '../../domain/repositories/ContactPresenceRepository';
import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { PresenceSharing } from '../../domain/PresenceSharing';
import { StopSharingContactPresenceMessage } from './messages/StopSharingContactPresenceMessage';

/**
 * Stops the exchange with one contact: the choice goes, the inbox the
 * contact wrote to is closed and what the contact sent is forgotten.
 */
export class ContactPresenceSharingStopper {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
    private readonly contactPresenceRepository: ContactPresenceRepository,
  ) {}

  public async stop(message: StopSharingContactPresenceMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const sharing = PresenceSharing.create(
      message.getConversationId(),
      message.getContactIdentityId(),
    );

    await this.presenceSharingRepository.delete(actorIdentityId, sharing);
    await this.contactPresenceRepository.close(actorIdentityId, sharing);
    this.contactPresenceRepository
      .board(actorIdentityId)
      .forget(sharing.getContactId());
  }
}
