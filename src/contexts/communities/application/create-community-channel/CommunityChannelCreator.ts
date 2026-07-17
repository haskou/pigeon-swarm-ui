import type { CommunityChannel } from '../../domain/entities/CommunityChannel';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { CreateCommunityChannelMessage } from './messages/CreateCommunityChannelMessage';

export class CommunityChannelCreator {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async create(
    message: CreateCommunityChannelMessage,
  ): Promise<CommunityChannel> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );
    const channel = message.getType().isVoice()
      ? await this.communityRepository.createVoiceChannel(
          community,
          message.getName(),
          message.getActorIdentityId(),
        )
      : await this.communityRepository.createTextChannel(
          community,
          message.getName(),
          message.getActorIdentityId(),
        );

    community.addChannel(channel, message.getOccurredAt());

    return channel;
  }
}
