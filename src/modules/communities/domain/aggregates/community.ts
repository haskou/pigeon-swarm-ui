import type {
  Community as CommunityResource,
  CommunityChannel,
  CommunityPermission,
} from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/aggregateRoot';
import { CommunityChannels } from '../communityChannels';
import { CommunityAccessPolicy } from '../communityPermissions';
import { CommunityId } from '../value-objects/communityId';
import { CommunityIdentityId } from '../value-objects/communityIdentityId';
import { CommunityName } from '../value-objects/communityName';

export class Community extends AggregateRoot {
  private constructor(
    private readonly id: CommunityId,
    private name: CommunityName,
    private readonly ownerIdentityId: CommunityIdentityId,
    private readonly resource: CommunityResource,
  ) {
    super();
  }

  public static fromResource(resource: CommunityResource): Community {
    return new Community(
      CommunityId.fromString(resource.id),
      CommunityName.fromString(resource.name),
      CommunityIdentityId.fromString(resource.ownerIdentityId),
      resource,
    );
  }

  public canSeeChannel(channel: CommunityChannel, identityId: string): boolean {
    return CommunityAccessPolicy.canSeeChannel(
      this.resource,
      channel,
      identityId,
    );
  }

  public channels(): CommunityChannel[] {
    return CommunityChannels.all(this.resource);
  }

  public getId(): CommunityId {
    return this.id;
  }

  public getName(): CommunityName {
    return this.name;
  }

  public isOwnedBy(identityId: CommunityIdentityId): boolean {
    return this.ownerIdentityId.isEqual(identityId);
  }

  public membersWithChannelAccess(channel: CommunityChannel): string[] {
    return CommunityAccessPolicy.membersWithChannelAccess(
      this.resource,
      channel,
    );
  }

  public permissionsFor(identityId: string): Set<CommunityPermission> {
    return CommunityAccessPolicy.permissionsFor(this.resource, identityId);
  }

  public rename(name: CommunityName): void {
    if (this.name.isEqual(name)) return;

    this.name = name;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'CommunityRenamed',
    });
  }
}
