import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { PresenceSharing } from '../../domain/PresenceSharing';
import { ShareContactPresenceMessage } from './messages/ShareContactPresenceMessage';

export class ContactPresenceSharer {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
  ) {}

  public async share(message: ShareContactPresenceMessage): Promise<void> {
    await this.presenceSharingRepository.save(
      message.getActorIdentityId(),
      PresenceSharing.create(
        message.getConversationId(),
        message.getContactIdentityId(),
      ),
    );
  }
}
