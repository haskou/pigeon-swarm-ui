import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityChannelId } from '../value-objects/CommunityChannelId';
import { CommunityChannelName } from '../value-objects/CommunityChannelName';
import { CommunityChannelType } from '../value-objects/CommunityChannelType';
import { CommunityIdentityId } from '../value-objects/CommunityIdentityId';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityChannelThreadSummary } from './CommunityChannelThreadSummary';

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
      primitives.threads.map(CommunityChannelThreadSummary.fromPrimitives),
    );
  }

  private constructor(
    private readonly id: CommunityChannelId,
    private name: CommunityChannelName,
    private readonly type: CommunityChannelType,
    private readonly createdAt: Timestamp,
    private visibleRoleIds: CommunityRoleId[],
    private readonly connectedIdentityIds: CommunityIdentityId[],
    private readonly threads: CommunityChannelThreadSummary[],
  ) {}

  public belongsTo(id: CommunityChannelId): boolean {
    return this.id.isEqual(id);
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
      threads: this.threads.map((thread) => thread.toPrimitives()),
      type: this.type.valueOf(),
      visibleRoleIds: this.visibleRoleIds.map((id) => id.toString()),
    };
  }
}
