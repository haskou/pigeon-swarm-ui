import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { KickCommunityMemberMessage } from './messages/KickCommunityMemberMessage';

export class CommunityMemberKicker {
  public constructor(private readonly communities: CommunityRepository) {}

  public async kick(message: KickCommunityMemberMessage): Promise<Community> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.kickMember(
      message.getMemberIdentityId(),
      message.getOccurredAt(),
    );

    return await this.communities.kickMember(
      community,
      message.getMemberIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
