import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UpdateCommunityChannelPermissionsMessage } from './messages/UpdateCommunityChannelPermissionsMessage';

export class CommunityChannelPermissionsUpdater {
  public constructor(private readonly communities: CommunityRepository) {}

  public async update(
    message: UpdateCommunityChannelPermissionsMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.restrictChannelTo(
      message.getChannelId(),
      message.getVisibleRoleIds(),
      message.getOccurredAt(),
    );

    return await this.communities.restrictChannel(
      community,
      message.getChannelId(),
      message.getActorIdentityId(),
    );
  }
}
