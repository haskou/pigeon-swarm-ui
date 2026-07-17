import type { CommunityRole } from '../../domain/entities/CommunityRole';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { CreateCommunityRoleMessage } from './messages/CreateCommunityRoleMessage';

export class CommunityRoleCreator {
  public constructor(private readonly communities: CommunityRepository) {}

  public async create(
    message: CreateCommunityRoleMessage,
  ): Promise<CommunityRole> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );
    const role = await this.communities.createRole(
      community,
      message.getName(),
      message.getPermissions(),
      message.getActorIdentityId(),
    );

    community.addRole(role, message.getOccurredAt());

    return role;
  }
}
