import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UpdateCommunityProfileMessage } from './messages/UpdateCommunityProfileMessage';

export class CommunityProfileUpdater {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async update(
    message: UpdateCommunityProfileMessage,
  ): Promise<Community> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.updateProfile(
      message.getName(),
      message.getDescription(),
      message.getAvatar(),
      message.getBanner(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.updateProfile(
      community,
      message.getActorIdentityId(),
    );
  }
}
