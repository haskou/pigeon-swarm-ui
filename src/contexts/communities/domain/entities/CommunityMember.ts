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

  private roleIdsWithEveryone(): CommunityRoleId[] {
    return [CommunityRoleId.EVERYONE, ...this.roleIds];
  }

  public assignRoles(roleIds: CommunityRoleId[]): void {
    this.roleIds = [...roleIds];
  }

  public ban(): void {
    this.banned = true;
  }

  public belongsTo(identityId: CommunityIdentityId): boolean {
    return this.identityId.isEqual(identityId);
  }

  public canAccess(
    channel: import('./CommunityChannel').CommunityChannel,
  ): boolean {
    return !this.banned && channel.canBeSeenBy(this.roleIdsWithEveryone());
  }

  public hasRole(roleId: CommunityRoleId): boolean {
    return this.roleIds.some((candidate) => candidate.isEqual(roleId));
  }

  public getIdentityId(): CommunityIdentityId {
    return this.identityId;
  }

  public getRoleIds(): CommunityRoleId[] {
    return [...this.roleIds];
  }

  public isBanned(): boolean {
    return this.banned;
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
