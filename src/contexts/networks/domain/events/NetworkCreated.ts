import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { NetworkId } from '../value-objects/NetworkId';

export class NetworkCreated implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = NetworkCreated.name;

  public constructor(networkId: NetworkId, occurredAt: Timestamp) {
    this.aggregateId = networkId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
