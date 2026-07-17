import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RemoveCommunityChannelMessage } from './messages/RemoveCommunityChannelMessage';

export class CommunityChannelRemover {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async remove(
    message: RemoveCommunityChannelMessage,
  ): Promise<Community> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.deleteChannel(message.getChannelId(), message.getOccurredAt());

    return await this.communityRepository.deleteChannel(
      community,
      message.getChannelId(),
      message.getActorIdentityId(),
    );
  }
}
