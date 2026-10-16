import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NodeAccessIdentityId } from '../value-objects/NodeAccessIdentityId';

/** The node owner issued a new version of the block list. */
export class NodeBlockListChanged implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = NodeBlockListChanged.name;

  public constructor(aggregateId: NodeAccessIdentityId, occurredAt: Timestamp) {
    this.aggregateId = aggregateId.valueOf();
    this.occurredAt = occurredAt.valueOf();
  }
}
