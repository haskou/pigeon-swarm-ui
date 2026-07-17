import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RenameCommunityChannelMessage } from './messages/RenameCommunityChannelMessage';

export class CommunityChannelRenamer {
  public constructor(private readonly communities: CommunityRepository) {}

  public async rename(
    message: RenameCommunityChannelMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.renameChannel(
      message.getChannelId(),
      message.getName(),
      message.getOccurredAt(),
    );

    return await this.communities.renameChannel(
      community,
      message.getChannelId(),
      message.getActorIdentityId(),
    );
  }
}
