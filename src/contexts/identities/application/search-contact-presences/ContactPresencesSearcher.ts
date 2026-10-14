import type { IdentityPresence } from '../../domain/IdentityPresence';
import type { ContactPresenceRepository } from '../../domain/repositories/ContactPresenceRepository';
import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { SearchContactPresencesMessage } from './messages/SearchContactPresencesMessage';

/**
 * The presence of every shared contact as the board holds it now, without
 * reading the relay, so an expired update shows as disconnected.
 */
export class ContactPresencesSearcher {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
    private readonly contactPresenceRepository: ContactPresenceRepository,
  ) {}

  public async search(
    message: SearchContactPresencesMessage,
  ): Promise<IdentityPresence[]> {
    const actorIdentityId = message.getActorIdentityId();
    const board = this.contactPresenceRepository.board(actorIdentityId);
    const sharings =
      await this.presenceSharingRepository.search(actorIdentityId);

    return sharings.map((sharing) =>
      board.presenceOf(sharing.getContactId(), message.getNow()),
    );
  }
}
