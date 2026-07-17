import type { PrimitiveOf } from '@haskou/value-objects';

import { CommunityPermission } from '../value-objects/CommunityPermission';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityRoleName } from '../value-objects/CommunityRoleName';

export class CommunityRole {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityRole>,
  ): CommunityRole {
    return new CommunityRole(
      CommunityRoleId.fromString(primitives.id),
      CommunityRoleName.fromString(primitives.name),
      primitives.permissions.map(CommunityPermission.fromPrimitives),
      primitives.builtIn,
    );
  }

  private constructor(
    private readonly id: CommunityRoleId,
    private name: CommunityRoleName,
    private permissions: CommunityPermission[],
    private readonly builtIn: boolean,
  ) {}

  public belongsTo(id: CommunityRoleId): boolean {
    return this.id.isEqual(id);
  }

  public update(
    name: CommunityRoleName,
    permissions: CommunityPermission[],
  ): void {
    this.name = name;
    this.permissions = [...permissions];
  }

  public toPrimitives() {
    return {
      builtIn: this.builtIn,
      id: this.id.toString(),
      name: this.name.toString(),
      permissions: this.permissions.map((permission) => permission.valueOf()),
    };
  }
}
