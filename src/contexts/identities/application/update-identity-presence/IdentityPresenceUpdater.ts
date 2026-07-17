import type { IdentityPresenceRepository } from '../../domain/repositories/IdentityPresenceRepository';

import { IdentityPresence } from '../../domain/IdentityPresence';
import { UpdateIdentityPresenceMessage } from './messages/UpdateIdentityPresenceMessage';

export class IdentityPresenceUpdater {
  public constructor(
    private readonly identityPresenceRepository: IdentityPresenceRepository,
  ) {}

  public async update(
    message: UpdateIdentityPresenceMessage,
  ): Promise<IdentityPresence> {
    const actorIdentityId = message.getActorIdentityId();
    const presence = IdentityPresence.create(
      actorIdentityId,
      message.getStatus(),
      message.getOccurredAt(),
    );

    return await this.identityPresenceRepository.update(
      presence,
      actorIdentityId,
    );
  }
}
