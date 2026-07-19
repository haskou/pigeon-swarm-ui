import { Timestamp } from '@haskou/value-objects';

import { PollActorId } from '../../../domain/value-objects/PollActorId';
import { PollId } from '../../../domain/value-objects/PollId';
import { PollOptionId } from '../../../domain/value-objects/PollOptionId';
import { PollVoterId } from '../../../domain/value-objects/PollVoterId';

export class VotePollMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly pollId: string,
    private readonly optionIds: string[],
    private readonly occurredAt: number,
  ) {}

  public getActorId(): PollActorId {
    return PollActorId.fromString(this.actorIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getOptionIds(): PollOptionId[] {
    return this.optionIds.map(PollOptionId.fromString);
  }

  public getPollId(): PollId {
    return PollId.fromString(this.pollId);
  }

  public getVoterId(): PollVoterId {
    return PollVoterId.fromString(this.actorIdentityId);
  }
}
