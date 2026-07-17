import type { CommunityRole } from '../../domain/entities/CommunityRole';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { UpdateCommunityRoleMessage } from './messages/UpdateCommunityRoleMessage';

export class CommunityRoleUpdater {
  public constructor(private readonly communities: CommunityRepository) {}

  public async update(
    message: UpdateCommunityRoleMessage,
  ): Promise<CommunityRole> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.updateRole(
      message.getRoleId(),
      message.getName(),
      message.getPermissions(),
      message.getOccurredAt(),
    );

    return await this.communities.updateRole(
      community,
      message.getRoleId(),
      message.getActorIdentityId(),
    );
  }
}
