import type { Poll } from '../Poll';
import type { PollActorId } from '../value-objects/PollActorId';
import type { PollId } from '../value-objects/PollId';

export interface PollRepository {
  close(poll: Poll, actorId: PollActorId): Promise<Poll>;
  create(poll: Poll, actorId: PollActorId): Promise<Poll>;
  find(id: PollId, actorId: PollActorId): Promise<Poll>;
  removeVote(poll: Poll, actorId: PollActorId): Promise<Poll>;
  vote(poll: Poll, actorId: PollActorId): Promise<Poll>;
}
