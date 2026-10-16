import { CommitmentId } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityChannelNotFoundError } from '../errors/CommunityChannelNotFoundError';

export class CommunityChannelId extends StringValueObject {
  public static fromString(value: string): CommunityChannelId {
    return new CommunityChannelId(value.trim());
  }

  /**
   * The id of the channel a member creates at `createdAt`, as the node
   * derives it.
   */
  public static derive(
    communityId: string,
    creatorIdentityId: string,
    createdAt: number,
  ): CommunityChannelId {
    return new CommunityChannelId(
      CommitmentId.communityChannel(communityId, creatorIdentityId, createdAt),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityChannelNotFoundError());
  }
}
