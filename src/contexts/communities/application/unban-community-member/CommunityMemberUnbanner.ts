import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UnbanCommunityMemberMessage } from './messages/UnbanCommunityMemberMessage';

export class CommunityMemberUnbanner {
  public constructor(private readonly communities: CommunityRepository) {}

  public async unban(message: UnbanCommunityMemberMessage): Promise<Community> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.unbanMember(
      message.getMemberIdentityId(),
      message.getOccurredAt(),
    );

    return await this.communities.unbanMember(
      community,
      message.getMemberIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
