import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UpdateCommunityChannelPermissionsMessage } from './messages/UpdateCommunityChannelPermissionsMessage';

export class CommunityChannelPermissionsUpdater {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async update(
    message: UpdateCommunityChannelPermissionsMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    const channel = community.restrictChannelTo(
      message.getChannelId(),
      message.getVisibleRoleIds(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.restrictChannel(
      community,
      channel,
      message.getActorIdentityId(),
    );
  }
}
