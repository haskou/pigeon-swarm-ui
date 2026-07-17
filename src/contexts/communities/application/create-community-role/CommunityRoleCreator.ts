import type { CommunityRole } from '../../domain/entities/CommunityRole';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { CreateCommunityRoleMessage } from './messages/CreateCommunityRoleMessage';

export class CommunityRoleCreator {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async create(
    message: CreateCommunityRoleMessage,
  ): Promise<CommunityRole> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );
    const role = await this.communityRepository.createRole(
      community,
      message.getName(),
      message.getPermissions(),
      message.getActorIdentityId(),
    );

    community.addRole(role, message.getOccurredAt());

    return role;
  }
}
