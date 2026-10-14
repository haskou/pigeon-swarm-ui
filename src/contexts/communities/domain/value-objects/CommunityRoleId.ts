import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityRoleNotFoundError } from '../errors/CommunityRoleNotFoundError';

export class CommunityRoleId extends StringValueObject {
  public static fromString(value: string): CommunityRoleId {
    return new CommunityRoleId(value.trim());
  }

  /**
   * The id of the role a member creates at `createdAt`, as the node derives
   * it: the first 24 hex chars of sha256(JSON(['role', community, creator,
   * createdAt])).
   */
  public static derive(
    communityId: string,
    creatorIdentityId: string,
    createdAt: number,
  ): CommunityRoleId {
    return new CommunityRoleId(
      SHA256Hash.from(
        JSON.stringify(['role', communityId, creatorIdentityId, createdAt]),
      )
        .toString()
        .slice(0, 24),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityRoleNotFoundError());
  }
}
