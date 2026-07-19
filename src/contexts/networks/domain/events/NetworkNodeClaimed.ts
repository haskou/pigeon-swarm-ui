import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NetworkNodeId } from '../value-objects/NetworkNodeId';
import type { NetworkNodeOwnerId } from '../value-objects/NetworkNodeOwnerId';

export class NetworkNodeClaimed implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly ownerId: string;

  public readonly type = NetworkNodeClaimed.name;

  public constructor(
    nodeId: NetworkNodeId,
    ownerId: NetworkNodeOwnerId,
    occurredAt: Timestamp,
  ) {
    this.aggregateId = nodeId.toString();
    this.ownerId = ownerId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
