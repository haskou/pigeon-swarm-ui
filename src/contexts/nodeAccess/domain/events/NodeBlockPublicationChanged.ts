import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NodeAccessNodeId } from '../value-objects/NodeAccessNodeId';

/** The node owner started or stopped publishing the block list. */
export class NodeBlockPublicationChanged implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = NodeBlockPublicationChanged.name;

  public constructor(aggregateId: NodeAccessNodeId, occurredAt: Timestamp) {
    this.aggregateId = aggregateId.valueOf();
    this.occurredAt = occurredAt.valueOf();
  }
}
