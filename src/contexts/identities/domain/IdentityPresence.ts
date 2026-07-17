import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { IdentityId } from './value-objects/IdentityId';
import { IdentityNetworkMemberships } from './value-objects/IdentityNetworkMemberships';
import { IdentityPresenceEventType } from './value-objects/IdentityPresenceEventType';
import { IdentityPresenceStatus } from './value-objects/IdentityPresenceStatus';

export class IdentityPresence extends AggregateRoot {
  public static create(
    identityId: IdentityId,
    status: IdentityPresenceStatus,
    occurredAt: Timestamp,
  ): IdentityPresence {
    status.assertSelectable();
    const presence = new IdentityPresence(
      identityId,
      status,
      occurredAt,
      IdentityNetworkMemberships.fromPrimitives([]),
    );

    presence.record({
      aggregateId: identityId.toString(),
      occurredAt: occurredAt.valueOf(),
      type: IdentityPresenceEventType.UPDATED.valueOf(),
    });

    return presence;
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<IdentityPresence>,
  ): IdentityPresence {
    return new IdentityPresence(
      IdentityId.fromString(primitives.identityId),
      IdentityPresenceStatus.fromPrimitives(primitives.status),
      new Timestamp(primitives.updatedAt),
      IdentityNetworkMemberships.fromPrimitives(primitives.networkIds),
      primitives.lastActivityAt === undefined
        ? undefined
        : new Timestamp(primitives.lastActivityAt),
      primitives.lastHeartbeatAt === undefined
        ? undefined
        : new Timestamp(primitives.lastHeartbeatAt),
    );
  }

  private constructor(
    private readonly identityId: IdentityId,
    private status: IdentityPresenceStatus,
    private updatedAt: Timestamp,
    private readonly networkMemberships: IdentityNetworkMemberships,
    private readonly lastActivityAt?: Timestamp,
    private readonly lastHeartbeatAt?: Timestamp,
  ) {
    super();
  }

  public belongsTo(identityId: IdentityId): boolean {
    return this.identityId.isEqual(identityId);
  }

  public update(status: IdentityPresenceStatus, occurredAt: Timestamp): void {
    status.assertSelectable();

    if (this.status.isEqual(status)) return;

    this.status = status;
    this.updatedAt = occurredAt;
    this.record({
      aggregateId: this.identityId.toString(),
      occurredAt: occurredAt.valueOf(),
      type: IdentityPresenceEventType.UPDATED.valueOf(),
    });
  }

  public toPrimitives() {
    return {
      identityId: this.identityId.toString(),
      lastActivityAt: this.lastActivityAt?.valueOf(),
      lastHeartbeatAt: this.lastHeartbeatAt?.valueOf(),
      networkIds: this.networkMemberships.toPrimitives(),
      status: this.status.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
    };
  }
}
