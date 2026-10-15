import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NodeAccessNodeId } from '../value-objects/NodeAccessNodeId';

/** The node owner changed which entries shared lists may never block. */
export class NodeBlockExceptionsChanged implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = NodeBlockExceptionsChanged.name;

  public constructor(aggregateId: NodeAccessNodeId, occurredAt: Timestamp) {
    this.aggregateId = aggregateId.valueOf();
    this.occurredAt = occurredAt.valueOf();
  }
}
