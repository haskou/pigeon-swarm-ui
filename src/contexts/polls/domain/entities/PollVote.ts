import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { PollOptionId } from '../value-objects/PollOptionId';
import { PollVoterId } from '../value-objects/PollVoterId';

export class PollVote {
  public static cast(
    voterId: PollVoterId,
    optionIds: PollOptionId[],
    createdAt: Timestamp,
  ): PollVote {
    return new PollVote(voterId, optionIds, createdAt);
  }

  public static fromPrimitives(primitives: PrimitiveOf<PollVote>): PollVote {
    return new PollVote(
      PollVoterId.fromString(primitives.voterIdentityId),
      primitives.optionIds.map(PollOptionId.fromString),
      new Timestamp(primitives.createdAt),
    );
  }

  private constructor(
    private readonly voterId: PollVoterId,
    private readonly optionIds: PollOptionId[],
    private readonly createdAt: Timestamp,
  ) {}

  public belongsTo(voterId: PollVoterId): boolean {
    return this.voterId.isEqual(voterId);
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      optionIds: this.optionIds.map((optionId) => optionId.toString()),
      voterIdentityId: this.voterId.toString(),
    };
  }
}
