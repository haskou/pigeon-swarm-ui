import type { ContactPresenceRepository } from '../../domain/repositories/ContactPresenceRepository';
import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { PublishContactPresenceMessage } from './messages/PublishContactPresenceMessage';

/**
 * Sends the actor's status to every contact it shares with, as the broadcast
 * paces it. A status kept from contacts, such as invisible, sends nothing.
 */
export class ContactPresencePublisher {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
    private readonly contactPresenceRepository: ContactPresenceRepository,
  ) {}

  public async publish(message: PublishContactPresenceMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const broadcast = this.contactPresenceRepository.broadcast(actorIdentityId);
    const sharings =
      await this.presenceSharingRepository.search(actorIdentityId);

    await Promise.all(
      sharings.map(async (sharing) => {
        const presence = broadcast.next(
          sharing,
          message.getStatus(),
          message.getOccurredAt(),
        );

        if (presence) {
          await this.contactPresenceRepository.publish(
            actorIdentityId,
            sharing,
            presence,
          );
        }
      }),
    );
  }
}
