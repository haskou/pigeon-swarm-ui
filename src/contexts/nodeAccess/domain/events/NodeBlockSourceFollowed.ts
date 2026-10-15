import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NodeAccessIdentityId } from '../value-objects/NodeAccessIdentityId';

/** The node owner followed or reconfigured another node owner's shared block list. */
export class NodeBlockSourceFollowed implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = NodeBlockSourceFollowed.name;

  public constructor(aggregateId: NodeAccessIdentityId, occurredAt: Timestamp) {
    this.aggregateId = aggregateId.valueOf();
    this.occurredAt = occurredAt.valueOf();
  }
}
