import type { PresenceSharing } from '../../domain/PresenceSharing';
import type { PresenceSharingRepository } from '../../domain/repositories/PresenceSharingRepository';

import { SearchPresenceSharingsMessage } from './messages/SearchPresenceSharingsMessage';

export class PresenceSharingsSearcher {
  public constructor(
    private readonly presenceSharingRepository: PresenceSharingRepository,
  ) {}

  public async search(
    message: SearchPresenceSharingsMessage,
  ): Promise<PresenceSharing[]> {
    return await this.presenceSharingRepository.search(
      message.getActorIdentityId(),
    );
  }
}
