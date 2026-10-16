import { CommitmentId } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityRoleNotFoundError } from '../errors/CommunityRoleNotFoundError';

export class CommunityRoleId extends StringValueObject {
  public static fromString(value: string): CommunityRoleId {
    return new CommunityRoleId(value.trim());
  }

  /**
   * The id of the role a member creates at `createdAt`, as the node derives
   * it.
   */
  public static derive(
    communityId: string,
    creatorIdentityId: string,
    createdAt: number,
  ): CommunityRoleId {
    return new CommunityRoleId(
      CommitmentId.communityRole(communityId, creatorIdentityId, createdAt),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityRoleNotFoundError());
  }
}
