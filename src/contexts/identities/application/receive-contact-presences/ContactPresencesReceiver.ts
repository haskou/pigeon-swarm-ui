import type { IdentityPresence } from '../../domain/IdentityPresence';
import type { ContactPresenceRepository } from '../../domain/repositories/ContactPresenceRepository';
import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { ReceiveContactPresencesMessage } from './messages/ReceiveContactPresencesMessage';

/**
 * Reads what each shared contact sent onto the board, then answers the
 * presence of every shared contact. An update counts only from the contact
 * of the sharing it arrived through.
 */
export class ContactPresencesReceiver {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
    private readonly contactPresenceRepository: ContactPresenceRepository,
  ) {}

  public async receive(
    message: ReceiveContactPresencesMessage,
  ): Promise<IdentityPresence[]> {
    const actorIdentityId = message.getActorIdentityId();
    const receivedAt = message.getReceivedAt();
    const board = this.contactPresenceRepository.board(actorIdentityId);
    const sharings =
      await this.presenceSharingRepository.search(actorIdentityId);
    const received = await Promise.all(
      sharings.map((sharing) =>
        this.contactPresenceRepository.receive(
          actorIdentityId,
          sharing,
          receivedAt,
        ),
      ),
    );

    sharings.forEach((sharing, index) => {
      for (const presence of received[index]) {
        if (presence.isFrom(sharing.getContactId())) {
          board.accept(presence, receivedAt);
        }
      }
    });

    return sharings.map((sharing) =>
      board.presenceOf(sharing.getContactId(), receivedAt),
    );
  }
}
