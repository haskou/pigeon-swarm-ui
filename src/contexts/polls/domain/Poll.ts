import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { PollVote } from './entities/PollVote';
import { PollClosedError } from './errors/PollClosedError';
import { PollOptionNotFoundError } from './errors/PollOptionNotFoundError';
import { PollSingleVoteRequiredError } from './errors/PollSingleVoteRequiredError';
import { PollClosed } from './events/PollClosed';
import { PollCreated } from './events/PollCreated';
import { PollVoteCast } from './events/PollVoteCast';
import { PollVoteRemoved } from './events/PollVoteRemoved';
import { PollDefinition } from './PollDefinition';
import { PollId } from './value-objects/PollId';
import { PollOptionId } from './value-objects/PollOptionId';
import { PollStatus } from './value-objects/PollStatus';
import { PollVoterId } from './value-objects/PollVoterId';

export class Poll extends AggregateRoot {
  public static create(
    definition: PollDefinition,
    occurredAt: Timestamp,
  ): Poll {
    const poll = new Poll(
      PollId.generate(),
      definition,
      PollStatus.open(),
      occurredAt,
      [],
    );

    poll.record(new PollCreated(poll.id, occurredAt));

    return poll;
  }

  public static fromPrimitives(primitives: PrimitiveOf<Poll>): Poll {
    return new Poll(
      PollId.fromString(primitives.id),
      PollDefinition.fromPrimitives(primitives.definition),
      PollStatus.fromPrimitives(primitives.status),
      new Timestamp(primitives.createdAt),
      primitives.votes.map(PollVote.fromPrimitives),
    );
  }

  private constructor(
    private readonly id: PollId,
    private readonly definition: PollDefinition,
    private status: PollStatus,
    private readonly createdAt: Timestamp,
    private votes: PollVote[],
  ) {
    super();
  }

  private assertOptionsExist(optionIds: PollOptionId[]): void {
    assert(
      this.definition.containsEveryOption(optionIds),
      new PollOptionNotFoundError(),
    );
  }

  public belongsTo(id: PollId): boolean {
    return this.id.isEqual(id);
  }

  public close(occurredAt: Timestamp): void {
    if (this.status.isClosed()) return;

    this.status = PollStatus.closed();
    this.record(new PollClosed(this.id, occurredAt));
  }

  public hasVoteFrom(voterId: PollVoterId): boolean {
    return this.votes.some((vote) => vote.belongsTo(voterId));
  }

  public removeVote(voterId: PollVoterId, occurredAt: Timestamp): void {
    const remainingVotes = this.votes.filter(
      (vote) => !vote.belongsTo(voterId),
    );

    if (remainingVotes.length === this.votes.length) return;

    this.votes = remainingVotes;
    this.record(new PollVoteRemoved(this.id, occurredAt));
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      definition: this.definition.toPrimitives(),
      id: this.id.toString(),
      status: this.status.valueOf(),
      votes: this.votes.map((vote) => vote.toPrimitives()),
    };
  }

  public vote(
    voterId: PollVoterId,
    optionIds: PollOptionId[],
    occurredAt: Timestamp,
  ): void {
    assert(this.status.isOpen(), new PollClosedError());
    assert(
      this.definition.allowsSelection(optionIds.length),
      new PollSingleVoteRequiredError(),
    );
    this.assertOptionsExist(optionIds);

    this.votes = this.votes.filter((vote) => !vote.belongsTo(voterId));
    this.votes.push(PollVote.cast(voterId, optionIds, occurredAt));
    this.record(new PollVoteCast(this.id, occurredAt));
  }
}
