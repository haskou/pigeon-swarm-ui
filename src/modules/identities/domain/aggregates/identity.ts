import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/aggregateRoot';
import { IdentityProfile } from '../profile/identityProfile';
import { ProfileName } from '../profile/profileName';
import { IdentityId } from '../value-objects/identityId';
import { IdentityNetworkId } from '../value-objects/identityNetworkId';
import { IdentityNetworkMemberships } from '../value-objects/identityNetworkMemberships';

export class Identity extends AggregateRoot {
  private constructor(
    private readonly id: IdentityId,
    private profile: IdentityProfile,
    private networkMemberships: IdentityNetworkMemberships,
  ) {
    super();
  }

  public static fromResource(resource: IdentityResource): Identity {
    return new Identity(
      IdentityId.fromString(resource.id),
      IdentityProfile.fromPrimitives(resource.profile),
      IdentityNetworkMemberships.fromPrimitives(resource.networks),
    );
  }

  public belongsToNetwork(networkId: IdentityNetworkId): boolean {
    return this.networkMemberships.has(networkId);
  }

  public getId(): IdentityId {
    return this.id;
  }

  public getProfile(): IdentityProfile {
    return this.profile;
  }

  public joinNetwork(networkId: IdentityNetworkId): void {
    if (this.networkMemberships.has(networkId)) return;

    this.networkMemberships = this.networkMemberships.add(networkId);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'IdentityJoinedNetwork',
    });
  }

  public rename(name: ProfileName): void {
    if (this.profile.getName().isEqual(name)) return;

    this.profile = this.profile.rename(name);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'IdentityRenamed',
    });
  }
}
