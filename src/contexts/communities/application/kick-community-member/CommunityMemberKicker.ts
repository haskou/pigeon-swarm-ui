import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { KickCommunityMemberMessage } from './messages/KickCommunityMemberMessage';

export class CommunityMemberKicker {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async kick(message: KickCommunityMemberMessage): Promise<Community> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.kickMember(
      message.getMemberIdentityId(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.kickMember(
      community,
      message.getMemberIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
