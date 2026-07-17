import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { IdentityProfile } from './profile/IdentityProfile';
import { IdentityEventType } from './value-objects/IdentityEventType';
import { IdentityId } from './value-objects/IdentityId';
import { IdentityNetworkId } from './value-objects/IdentityNetworkId';
import { IdentityNetworkMemberships } from './value-objects/IdentityNetworkMemberships';

export class Identity extends AggregateRoot {
  public static create(
    id: IdentityId,
    profile: IdentityProfile,
    networkMemberships: IdentityNetworkMemberships,
    occurredAt: Timestamp,
  ): Identity {
    const identity = new Identity(id, profile, networkMemberships, occurredAt);

    identity.record(
      identity.identifyEvent(IdentityEventType.CREATED, occurredAt),
    );

    return identity;
  }

  public static fromPrimitives(primitives: PrimitiveOf<Identity>): Identity {
    return new Identity(
      IdentityId.fromString(primitives.id),
      IdentityProfile.fromPrimitives(primitives.profile),
      IdentityNetworkMemberships.fromPrimitives(primitives.networkIds),
      new Timestamp(primitives.createdAt),
    );
  }

  private constructor(
    private readonly id: IdentityId,
    private profile: IdentityProfile,
    private networkMemberships: IdentityNetworkMemberships,
    private readonly createdAt: Timestamp,
  ) {
    super();
  }

  private identifyEvent(type: IdentityEventType, occurredAt: Timestamp) {
    return {
      aggregateId: this.id.toString(),
      occurredAt: occurredAt.valueOf(),
      type: type.valueOf(),
    };
  }

  public belongsTo(id: IdentityId): boolean {
    return this.id.isEqual(id);
  }

  public belongsToNetwork(networkId: IdentityNetworkId): boolean {
    return this.networkMemberships.has(networkId);
  }

  public updateProfile(
    profile: IdentityProfile,
    networkMemberships: IdentityNetworkMemberships,
    occurredAt: Timestamp,
  ): void {
    if (
      this.profile.isEqual(profile) &&
      this.networkMemberships.isEqual(networkMemberships)
    ) {
      return;
    }

    this.profile = profile;
    this.networkMemberships = networkMemberships;
    this.record(
      this.identifyEvent(IdentityEventType.PROFILE_UPDATED, occurredAt),
    );
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      id: this.id.toString(),
      networkIds: this.networkMemberships.toPrimitives(),
      profile: this.profile.toPrimitives(),
    };
  }
}
