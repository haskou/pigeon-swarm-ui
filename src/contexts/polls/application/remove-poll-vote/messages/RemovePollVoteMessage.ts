import { Timestamp } from '@haskou/value-objects';

import { PollActorId } from '../../../domain/value-objects/PollActorId';
import { PollId } from '../../../domain/value-objects/PollId';
import { PollVoterId } from '../../../domain/value-objects/PollVoterId';

export class RemovePollVoteMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly pollId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorId(): PollActorId {
    return PollActorId.fromString(this.actorIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getPollId(): PollId {
    return PollId.fromString(this.pollId);
  }

  public getVoterId(): PollVoterId {
    return PollVoterId.fromString(this.actorIdentityId);
  }
}
