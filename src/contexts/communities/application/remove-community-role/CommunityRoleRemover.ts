import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { RemoveCommunityRoleMessage } from './messages/RemoveCommunityRoleMessage';

export class CommunityRoleRemover {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async remove(message: RemoveCommunityRoleMessage): Promise<void> {
    const community = await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );

    community.deleteRole(message.getRoleId(), message.getOccurredAt());
    await this.communityRepository.deleteRole(
      community,
      message.getRoleId(),
      message.getActorIdentityId(),
    );
  }
}
