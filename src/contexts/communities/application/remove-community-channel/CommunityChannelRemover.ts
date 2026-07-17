import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RemoveCommunityChannelMessage } from './messages/RemoveCommunityChannelMessage';

export class CommunityChannelRemover {
  public constructor(private readonly communities: CommunityRepository) {}

  public async remove(
    message: RemoveCommunityChannelMessage,
  ): Promise<Community> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.deleteChannel(message.getChannelId(), message.getOccurredAt());

    return await this.communities.deleteChannel(
      community,
      message.getChannelId(),
      message.getActorIdentityId(),
    );
  }
}
