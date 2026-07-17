import type { IdentityPresence } from '../../domain/IdentityPresence';
import type { IdentityPresenceRepository } from '../../domain/repositories/IdentityPresenceRepository';

import { SearchIdentityPresencesMessage } from './messages/SearchIdentityPresencesMessage';

export class IdentityPresencesSearcher {
  public constructor(
    private readonly identityPresenceRepository: IdentityPresenceRepository,
  ) {}

  public async search(
    message: SearchIdentityPresencesMessage,
  ): Promise<IdentityPresence[]> {
    return await this.identityPresenceRepository.search(
      message.getIdentityIds(),
      message.getActorIdentityId(),
    );
  }
}
