import { PollActorId } from '../../../domain/value-objects/PollActorId';
import { PollId } from '../../../domain/value-objects/PollId';

export class FindPollMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly pollId: string,
  ) {}

  public getActorId(): PollActorId {
    return PollActorId.fromString(this.actorIdentityId);
  }

  public getPollId(): PollId {
    return PollId.fromString(this.pollId);
  }
}
