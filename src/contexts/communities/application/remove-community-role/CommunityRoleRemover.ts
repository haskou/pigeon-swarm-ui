import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RemoveCommunityRoleMessage } from './messages/RemoveCommunityRoleMessage';

export class CommunityRoleRemover {
  public constructor(private readonly communities: CommunityRepository) {}

  public async remove(message: RemoveCommunityRoleMessage): Promise<void> {
    const community = await this.communities.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.deleteRole(message.getRoleId(), message.getOccurredAt());
    await this.communities.deleteRole(
      community,
      message.getRoleId(),
      message.getActorIdentityId(),
    );
  }
}
