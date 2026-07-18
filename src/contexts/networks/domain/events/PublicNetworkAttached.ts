import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NetworkNodeId } from '../value-objects/NetworkNodeId';

export class PublicNetworkAttached implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = PublicNetworkAttached.name;

  public constructor(nodeId: NetworkNodeId, occurredAt: Timestamp) {
    this.aggregateId = nodeId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
