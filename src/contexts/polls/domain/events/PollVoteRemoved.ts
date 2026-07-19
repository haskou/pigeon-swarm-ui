import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { PollId } from '../value-objects/PollId';

export class PollVoteRemoved implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = PollVoteRemoved.name;

  public constructor(pollId: PollId, occurredAt: Timestamp) {
    this.aggregateId = pollId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
