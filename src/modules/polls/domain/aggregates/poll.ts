import { DomainError, Timestamp } from '@haskou/value-objects';

import type {
  PollResource,
  PollVote,
} from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/aggregateRoot';
import { PollId } from '../value-objects/pollId';
import { PollOptionId } from '../value-objects/pollOptionId';
import { PollStatus } from '../value-objects/pollStatus';
import { PollVoterId } from '../value-objects/pollVoterId';

export class Poll extends AggregateRoot {
  private constructor(
    private readonly id: PollId,
    private status: PollStatus,
    private readonly resource: PollResource,
    private votes: PollVote[],
  ) {
    super();
  }

  public static fromResource(resource: PollResource): Poll {
    return new Poll(
      PollId.fromString(resource.id),
      PollStatus.fromPrimitive(resource.status),
      resource,
      resource.votes,
    );
  }

  public close(): void {
    if (this.status.isClosed()) return;

    this.status = PollStatus.closed();
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'PollClosed',
    });
  }

  public getId(): PollId {
    return this.id;
  }

  public hasVoteFrom(voterId: PollVoterId): boolean {
    return this.votes.some((vote) =>
      PollVoterId.fromString(vote.voterIdentityId).isEqual(voterId),
    );
  }

  public removeVote(voterId: PollVoterId): void {
    const votes = this.votes.filter((vote) =>
      PollVoterId.fromString(vote.voterIdentityId).isNotEqual(voterId),
    );

    if (votes.length === this.votes.length) return;

    this.votes = votes;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'PollVoteRemoved',
    });
  }

  public toResource(): PollResource {
    return {
      ...this.resource,
      status: this.status.toString() as PollResource['status'],
      votes: this.votes,
    };
  }

  public vote(
    voterId: PollVoterId,
    optionIds: PollOptionId[],
    createdAt: Timestamp,
  ): void {
    if (this.status.isClosed()) {
      throw new DomainError('Closed polls cannot receive votes.');
    }

    if (!this.resource.allowsMultipleVotes && optionIds.length > 1) {
      throw new DomainError('This poll accepts one option per vote.');
    }

    this.assertOptionsExist(optionIds);
    this.removeVote(voterId);
    this.votes = [
      ...this.votes,
      {
        createdAt: createdAt.valueOf(),
        optionIds: optionIds.map((optionId) => optionId.toString()),
        voterIdentityId: voterId.toString(),
      },
    ];
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'PollVoteCast',
    });
  }

  private assertOptionsExist(optionIds: PollOptionId[]): void {
    const missingOption = optionIds.find((optionId) =>
      this.resource.options.every((option) =>
        PollOptionId.fromString(option.id).isNotEqual(optionId),
      ),
    );

    if (missingOption) {
      throw new DomainError('Poll option does not exist.');
    }
  }
}
