import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RenameCommunityChannelMessage } from './messages/RenameCommunityChannelMessage';

export class CommunityChannelRenamer {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async rename(
    message: RenameCommunityChannelMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    const channel = community.renameChannel(
      message.getChannelId(),
      message.getName(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.renameChannel(
      community,
      channel,
      message.getActorIdentityId(),
    );
  }
}
