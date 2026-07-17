import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityMemberNotFoundError } from '../errors/CommunityMemberNotFoundError';
import { CommunityIdentityId } from '../value-objects/CommunityIdentityId';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityMember } from './CommunityMember';

export class CommunityMembers {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityMember>[],
  ): CommunityMembers {
    return new CommunityMembers(primitives.map(CommunityMember.fromPrimitives));
  }

  private constructor(private readonly members: CommunityMember[]) {}

  private find(identityId: CommunityIdentityId): CommunityMember {
    const member = this.members.find((candidate) =>
      candidate.belongsTo(identityId),
    );

    assert(member, new CommunityMemberNotFoundError());

    return member;
  }

  public assignRoles(
    identityId: CommunityIdentityId,
    roleIds: CommunityRoleId[],
  ): CommunityMember {
    const member = this.find(identityId);

    member.assignRoles(roleIds);

    return member;
  }

  public ban(identityId: CommunityIdentityId): void {
    this.find(identityId).ban();
  }

  public remove(identityId: CommunityIdentityId): void {
    const member = this.find(identityId);

    this.members.splice(this.members.indexOf(member), 1);
  }

  public removeRole(roleId: CommunityRoleId): void {
    this.members.forEach((member) => member.removeRole(roleId));
  }

  public unban(identityId: CommunityIdentityId): void {
    this.find(identityId).unban();
  }

  public toPrimitives() {
    return this.members.map((member) => member.toPrimitives());
  }
}
