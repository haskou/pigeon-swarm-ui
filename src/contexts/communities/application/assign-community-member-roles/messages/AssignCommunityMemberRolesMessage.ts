import { Timestamp } from '@haskou/value-objects';

import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';
import { CommunityRoleId } from '../../../domain/value-objects/CommunityRoleId';

export class AssignCommunityMemberRolesMessage {
  public constructor(
    private readonly communityId: string,
    private readonly memberIdentityId: string,
    private readonly roleIds: string[],
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getCommunityId(): CommunityId {
    return CommunityId.fromString(this.communityId);
  }

  public getMemberIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.memberIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getRoleIds(): CommunityRoleId[] {
    return this.roleIds.map(CommunityRoleId.fromString);
  }
}
