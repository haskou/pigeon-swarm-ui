import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityChannelId } from '../value-objects/CommunityChannelId';
import { CommunityChannelName } from '../value-objects/CommunityChannelName';
import { CommunityChannelType } from '../value-objects/CommunityChannelType';
import { CommunityIdentityId } from '../value-objects/CommunityIdentityId';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';

export class CommunityChannel {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityChannel>,
  ): CommunityChannel {
    return new CommunityChannel(
      CommunityChannelId.fromString(primitives.id),
      CommunityChannelName.fromString(primitives.name),
      CommunityChannelType.fromPrimitives(primitives.type),
      new Timestamp(primitives.createdAt),
      primitives.visibleRoleIds.map(CommunityRoleId.fromString),
      primitives.connectedIdentityIds.map(CommunityIdentityId.fromString),
    );
  }

  private constructor(
    private readonly id: CommunityChannelId,
    private name: CommunityChannelName,
    private readonly type: CommunityChannelType,
    private readonly createdAt: Timestamp,
    private visibleRoleIds: CommunityRoleId[],
    private readonly connectedIdentityIds: CommunityIdentityId[],
  ) {}

  public belongsTo(id: CommunityChannelId): boolean {
    return this.id.isEqual(id);
  }

  public canBeSeenBy(roleIds: CommunityRoleId[]): boolean {
    return (
      this.visibleRoleIds.length === 0 ||
      this.visibleRoleIds.some(
        (visibleRoleId) =>
          visibleRoleId.isEveryone() ||
          roleIds.some((roleId) => roleId.isEqual(visibleRoleId)),
      )
    );
  }

  public getName(): CommunityChannelName {
    return this.name;
  }

  public getVisibleRoleIds(): CommunityRoleId[] {
    return [...this.visibleRoleIds];
  }

  public isText(): boolean {
    return this.type.isText();
  }

  public isVoice(): boolean {
    return this.type.isVoice();
  }

  public rename(name: CommunityChannelName): void {
    this.name = name;
  }

  public restrictTo(roleIds: CommunityRoleId[]): void {
    this.visibleRoleIds = [...roleIds];
  }

  public toPrimitives() {
    return {
      connectedIdentityIds: this.connectedIdentityIds.map((id) =>
        id.toString(),
      ),
      createdAt: this.createdAt.valueOf(),
      id: this.id.toString(),
      name: this.name.toString(),
      type: this.type.valueOf(),
      visibleRoleIds: this.visibleRoleIds.map((id) => id.toString()),
    };
  }
}
