import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { AssignCommunityMemberRolesMessage } from './messages/AssignCommunityMemberRolesMessage';

export class CommunityMemberRolesAssigner {
  public constructor(private readonly communities: CommunityRepository) {}

  public async assign(
    message: AssignCommunityMemberRolesMessage,
  ): Promise<Community> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.assignMemberRoles(
      message.getMemberIdentityId(),
      message.getRoleIds(),
      message.getOccurredAt(),
    );

    return await this.communities.assignMemberRoles(
      community,
      message.getMemberIdentityId(),
      message.getActorIdentityId(),
    );
  }
}
