import type { Identity } from '../../domain/Identity';
import type { IdentityRepository } from '../../domain/repositories/IdentityRepository';

import { UpdateIdentityProfileMessage } from './messages/UpdateIdentityProfileMessage';

export class IdentityProfileUpdater {
  public constructor(private readonly identityRepository: IdentityRepository) {}

  public async update(
    message: UpdateIdentityProfileMessage,
  ): Promise<Identity> {
    const actorIdentityId = message.getActorIdentityId();
    const identity = await this.identityRepository.find(actorIdentityId);

    identity.updateProfile(
      message.getProfile(),
      message.getNetworkMemberships(),
      message.getOccurredAt(),
    );

    return await this.identityRepository.update(identity, actorIdentityId);
  }
}
