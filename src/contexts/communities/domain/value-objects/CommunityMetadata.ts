import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

import { CommunityEventType } from './CommunityEventType';
import { CommunityId } from './CommunityId';
import { CommunityIdentityId } from './CommunityIdentityId';
import { CommunityNetworkId } from './CommunityNetworkId';

export class CommunityMetadata {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityMetadata>,
  ): CommunityMetadata {
    return new CommunityMetadata(
      CommunityId.fromString(primitives.id),
      CommunityIdentityId.fromString(primitives.ownerIdentityId),
      CommunityNetworkId.fromString(primitives.networkId),
      new Timestamp(primitives.createdAt),
    );
  }

  private constructor(
    private readonly id: CommunityId,
    private readonly ownerIdentityId: CommunityIdentityId,
    private readonly networkId: CommunityNetworkId,
    private readonly createdAt: Timestamp,
  ) {}

  public identifyEvent(
    type: CommunityEventType,
    occurredAt: Timestamp,
  ): DomainEvent {
    return {
      aggregateId: this.id.toString(),
      occurredAt: occurredAt.valueOf(),
      type: type.valueOf(),
    };
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      id: this.id.toString(),
      networkId: this.networkId.toString(),
      ownerIdentityId: this.ownerIdentityId.toString(),
    };
  }
}
