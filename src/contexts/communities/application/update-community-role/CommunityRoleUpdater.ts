import type { CommunityRole } from '../../domain/entities/CommunityRole';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UpdateCommunityRoleMessage } from './messages/UpdateCommunityRoleMessage';

export class CommunityRoleUpdater {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async update(
    message: UpdateCommunityRoleMessage,
  ): Promise<CommunityRole> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    const role = community.updateRole(
      message.getRoleId(),
      message.getName(),
      message.getPermissions(),
      message.getOccurredAt(),
    );

    return await this.communityRepository.updateRole(
      community,
      role,
      message.getActorIdentityId(),
    );
  }
}
