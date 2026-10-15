import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityChannelNotFoundError } from '../errors/CommunityChannelNotFoundError';

export class CommunityChannelId extends StringValueObject {
  public static fromString(value: string): CommunityChannelId {
    return new CommunityChannelId(value.trim());
  }

  /**
   * The id of the channel a member creates at `createdAt`, as the node
   * derives it: the first 24 hex chars of sha256(JSON(['channel', community,
   * creator, createdAt])).
   */
  public static derive(
    communityId: string,
    creatorIdentityId: string,
    createdAt: number,
  ): CommunityChannelId {
    return new CommunityChannelId(
      SHA256Hash.from(
        JSON.stringify(['channel', communityId, creatorIdentityId, createdAt]),
      )
        .toString()
        .slice(0, 24),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityChannelNotFoundError());
  }
}
