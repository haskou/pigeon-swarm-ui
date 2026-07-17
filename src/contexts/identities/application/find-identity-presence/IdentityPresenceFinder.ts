import type { IdentityPresence } from '../../domain/IdentityPresence';
import type { IdentityPresenceRepository } from '../../domain/repositories/IdentityPresenceRepository';

import { FindIdentityPresenceMessage } from './messages/FindIdentityPresenceMessage';

export class IdentityPresenceFinder {
  public constructor(
    private readonly identityPresenceRepository: IdentityPresenceRepository,
  ) {}

  public async find(
    message: FindIdentityPresenceMessage,
  ): Promise<IdentityPresence> {
    return await this.identityPresenceRepository.find(
      message.getIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
