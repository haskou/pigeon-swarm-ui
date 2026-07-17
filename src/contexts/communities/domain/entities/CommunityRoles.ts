import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityRoleNotFoundError } from '../errors/CommunityRoleNotFoundError';
import { CommunityPermission } from '../value-objects/CommunityPermission';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityRoleName } from '../value-objects/CommunityRoleName';
import { CommunityRole } from './CommunityRole';

export class CommunityRoles {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityRole>[],
  ): CommunityRoles {
    return new CommunityRoles(primitives.map(CommunityRole.fromPrimitives));
  }

  private constructor(private readonly roles: CommunityRole[]) {}

  private find(roleId: CommunityRoleId): CommunityRole {
    const role = this.roles.find((candidate) => candidate.belongsTo(roleId));

    assert(role, new CommunityRoleNotFoundError());

    return role;
  }

  public add(role: CommunityRole): void {
    this.roles.push(role);
  }

  public assertExist(roleIds: CommunityRoleId[]): void {
    roleIds.forEach((roleId) => this.find(roleId));
  }

  public remove(roleId: CommunityRoleId): void {
    const role = this.find(roleId);

    this.roles.splice(this.roles.indexOf(role), 1);
  }

  public update(
    roleId: CommunityRoleId,
    name: CommunityRoleName,
    permissions: CommunityPermission[],
  ): CommunityRole {
    const role = this.find(roleId);

    role.update(name, permissions);

    return role;
  }

  public toPrimitives() {
    return this.roles.map((role) => role.toPrimitives());
  }
}
