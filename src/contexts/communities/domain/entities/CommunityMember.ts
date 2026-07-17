import type { PrimitiveOf } from '@haskou/value-objects';

import { CommunityIdentityId } from '../value-objects/CommunityIdentityId';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';

export class CommunityMember {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityMember>,
  ): CommunityMember {
    return new CommunityMember(
      CommunityIdentityId.fromString(primitives.identityId),
      primitives.roleIds.map(CommunityRoleId.fromString),
      primitives.banned,
    );
  }

  private constructor(
    private readonly identityId: CommunityIdentityId,
    private roleIds: CommunityRoleId[],
    private banned: boolean,
  ) {}

  public assignRoles(roleIds: CommunityRoleId[]): void {
    this.roleIds = [...roleIds];
  }

  public ban(): void {
    this.banned = true;
  }

  public belongsTo(identityId: CommunityIdentityId): boolean {
    return this.identityId.isEqual(identityId);
  }

  public removeRole(roleId: CommunityRoleId): void {
    this.roleIds = this.roleIds.filter(
      (candidate) => !candidate.isEqual(roleId),
    );
  }

  public unban(): void {
    this.banned = false;
  }

  public toPrimitives() {
    return {
      banned: this.banned,
      identityId: this.identityId.toString(),
      roleIds: this.roleIds.map((roleId) => roleId.toString()),
    };
  }
}
