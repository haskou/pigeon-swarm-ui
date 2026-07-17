import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { AssignCommunityMemberRolesMessage } from './messages/AssignCommunityMemberRolesMessage';

export class CommunityMemberRolesAssigner {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async assign(
    message: AssignCommunityMemberRolesMessage,
  ): Promise<Community> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    const member = community.assignMemberRoles(
      message.getMemberIdentityId(),
      message.getRoleIds(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.assignMemberRoles(
      community,
      member,
      message.getActorIdentityId(),
    );
  }
}
