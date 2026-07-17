import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { BanCommunityMemberMessage } from './messages/BanCommunityMemberMessage';

export class CommunityMemberBanner {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async ban(message: BanCommunityMemberMessage): Promise<Community> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.banMember(message.getMemberIdentityId(), message.getOccurredAt());

    return await this.communityRepository.banMember(
      community,
      message.getMemberIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
