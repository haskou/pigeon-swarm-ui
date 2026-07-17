import { Timestamp } from '@haskou/value-objects';

import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';
import { CommunityPermission } from '../../../domain/value-objects/CommunityPermission';
import { CommunityRoleName } from '../../../domain/value-objects/CommunityRoleName';

export class CreateCommunityRoleMessage {
  public constructor(
    private readonly communityId: string,
    private readonly name: string,
    private readonly permissions: string[],
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getCommunityId(): CommunityId {
    return CommunityId.fromString(this.communityId);
  }

  public getName(): CommunityRoleName {
    return CommunityRoleName.fromString(this.name);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getPermissions(): CommunityPermission[] {
    return this.permissions.map(CommunityPermission.fromPrimitives);
  }
}
