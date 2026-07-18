import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { PollId } from '../value-objects/PollId';

export class PollClosed implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = PollClosed.name;

  public constructor(pollId: PollId, occurredAt: Timestamp) {
    this.aggregateId = pollId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
