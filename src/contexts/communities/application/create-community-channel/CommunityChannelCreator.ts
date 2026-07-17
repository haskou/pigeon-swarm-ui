import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { CreateCommunityChannelMessage } from './messages/CreateCommunityChannelMessage';

export class CommunityChannelCreator {
  public constructor(private readonly communities: CommunityRepository) {}

  public async create(
    message: CreateCommunityChannelMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );
    const channel = message.getType().isVoice()
      ? await this.communities.createVoiceChannel(
          community,
          message.getName(),
          message.getActorIdentityId(),
        )
      : await this.communities.createTextChannel(
          community,
          message.getName(),
          message.getActorIdentityId(),
        );

    community.addChannel(channel, message.getOccurredAt());

    return channel;
  }
}
