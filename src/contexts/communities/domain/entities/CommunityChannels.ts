import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityChannelNotFoundError } from '../errors/CommunityChannelNotFoundError';
import { CommunityChannelId } from '../value-objects/CommunityChannelId';
import { CommunityChannelName } from '../value-objects/CommunityChannelName';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityChannel } from './CommunityChannel';

export class CommunityChannels {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityChannel>[],
  ): CommunityChannels {
    return new CommunityChannels(
      primitives.map(CommunityChannel.fromPrimitives),
    );
  }

  private constructor(private readonly channels: CommunityChannel[]) {}

  private find(channelId: CommunityChannelId): CommunityChannel {
    const channel = this.channels.find((candidate) =>
      candidate.belongsTo(channelId),
    );

    assert(channel, new CommunityChannelNotFoundError());

    return channel;
  }

  public add(channel: CommunityChannel): void {
    this.channels.push(channel);
  }

  public remove(channelId: CommunityChannelId): void {
    const channel = this.find(channelId);

    this.channels.splice(this.channels.indexOf(channel), 1);
  }

  public rename(
    channelId: CommunityChannelId,
    name: CommunityChannelName,
  ): CommunityChannel {
    const channel = this.find(channelId);

    channel.rename(name);

    return channel;
  }

  public restrict(
    channelId: CommunityChannelId,
    roleIds: CommunityRoleId[],
  ): CommunityChannel {
    const channel = this.find(channelId);

    channel.restrictTo(roleIds);

    return channel;
  }

  public toPrimitives() {
    return this.channels.map((channel) => channel.toPrimitives());
  }
}
