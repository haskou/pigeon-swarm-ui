import type { CommunityChannel } from '../../../../shared/domain/pigeonResources.types';

export type ManagedCommunityChannel = CommunityChannel & { pending?: boolean };

type ManagedCommunityChannelsInput = {
  channelDrafts: Record<string, string>;
  channelOrder: ManagedCommunityChannel[];
  channelPermissionDrafts: Record<string, string[]>;
  deletedChannelIds: string[];
  originalChannelIds: string[];
};

export class ManagedCommunityChannels {
  public static hasBlankName(input: ManagedCommunityChannelsInput): boolean {
    return input.channelOrder.some(
      (channel) => !ManagedCommunityChannels.nameFor(channel, input).trim(),
    );
  }

  public static hasChanges(input: ManagedCommunityChannelsInput): boolean {
    return (
      input.deletedChannelIds.length > 0 ||
      ManagedCommunityChannels.hasOrderChanges(input) ||
      input.channelOrder.some(
        (channel) =>
          Boolean(channel.pending) ||
          ManagedCommunityChannels.nameFor(channel, input) !== channel.name ||
          ManagedCommunityChannels.hasVisibleRoleChanges(channel, input),
      )
    );
  }

  public static orderSavedChannels(
    savedChannels: CommunityChannel[],
    input: ManagedCommunityChannelsInput,
  ): CommunityChannel[] {
    const savedChannelsById = new Map(
      savedChannels.map((channel) => [channel.id, channel]),
    );
    const originalChannelIds = new Set(input.originalChannelIds);
    const usedChannelIds = new Set<string>();
    const orderedChannels: CommunityChannel[] = [];

    for (const channel of input.channelOrder) {
      if (input.deletedChannelIds.includes(channel.id)) continue;

      const savedChannel = savedChannelsById.get(channel.id);

      if (savedChannel) {
        orderedChannels.push(savedChannel);
        usedChannelIds.add(savedChannel.id);
        continue;
      }

      if (!channel.pending) continue;

      const createdChannel = savedChannels.find(
        (candidate) =>
          !usedChannelIds.has(candidate.id) &&
          !originalChannelIds.has(candidate.id) &&
          candidate.type === channel.type &&
          candidate.name === ManagedCommunityChannels.nameFor(channel, input),
      );

      if (!createdChannel) continue;

      orderedChannels.push(createdChannel);
      usedChannelIds.add(createdChannel.id);
    }

    return [
      ...orderedChannels,
      ...savedChannels.filter((channel) => !usedChannelIds.has(channel.id)),
    ];
  }

  public static hasOrderChanges(input: ManagedCommunityChannelsInput): boolean {
    const currentExistingChannelIds = input.channelOrder
      .filter(
        (channel) =>
          !channel.pending && !input.deletedChannelIds.includes(channel.id),
      )
      .map((channel) => channel.id);
    const originalRemainingChannelIds = input.originalChannelIds.filter(
      (channelId) => !input.deletedChannelIds.includes(channelId),
    );

    return (
      ManagedCommunityChannels.channelOrderKey(currentExistingChannelIds) !==
      ManagedCommunityChannels.channelOrderKey(originalRemainingChannelIds)
    );
  }

  public static hasVisibleRoleChanges(
    channel: ManagedCommunityChannel,
    input: ManagedCommunityChannelsInput,
  ): boolean {
    return !ManagedCommunityChannels.haveSameRoleIds(
      ManagedCommunityChannels.visibleRoleIdsFor(channel, input),
      ManagedCommunityChannels.originalVisibleRoleIdsFor(channel),
    );
  }

  public static nameFor(
    channel: ManagedCommunityChannel,
    input: Pick<ManagedCommunityChannelsInput, 'channelDrafts'>,
  ): string {
    return (input.channelDrafts[channel.id] ?? channel.name).trim();
  }

  public static visibleRoleIdsFor(
    channel: ManagedCommunityChannel,
    input: Pick<ManagedCommunityChannelsInput, 'channelPermissionDrafts'>,
  ): string[] {
    return input.channelPermissionDrafts[channel.id] ?? ['everyone'];
  }

  private static haveSameRoleIds(left: string[], right: string[]): boolean {
    return (
      ManagedCommunityChannels.roleKey(left) ===
      ManagedCommunityChannels.roleKey(right)
    );
  }

  private static originalVisibleRoleIdsFor(
    channel: ManagedCommunityChannel,
  ): string[] {
    return channel.permissions?.visibleRoleIds ?? ['everyone'];
  }

  private static roleKey(roleIds: string[]): string {
    return [...new Set(roleIds)].sort().join('\u0000');
  }

  private static channelOrderKey(channelIds: string[]): string {
    return channelIds.join('\u0000');
  }
}
