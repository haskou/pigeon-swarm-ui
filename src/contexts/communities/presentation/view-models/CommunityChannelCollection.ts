import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../../shared/domain/pigeonResources.types';

export class CommunityChannelCollection {
  private static mergeCurrentChannelsWithPreferredOrder({
    currentChannels,
    preferredOrder,
  }: {
    currentChannels: CommunityChannel[];
    preferredOrder?: CommunityChannel[];
  }): CommunityChannel[] {
    if (!preferredOrder) return currentChannels;

    const currentChannelsById = new Map(
      currentChannels.map((channel) => [channel.id, channel]),
    );
    const orderedChannels: CommunityChannel[] = [];

    for (const channel of preferredOrder) {
      const currentChannel = currentChannelsById.get(channel.id);

      if (!currentChannel) continue;

      orderedChannels.push(currentChannel);
      currentChannelsById.delete(channel.id);
    }

    return [...orderedChannels, ...currentChannelsById.values()];
  }

  public static fromCommunity(
    community: Community,
  ): CommunityChannelCollection {
    return new CommunityChannelCollection(
      CommunityChannelCollection.mergeCurrentChannelsWithPreferredOrder({
        currentChannels: [
          ...community.textChannels,
          ...(community.voiceChannels ?? []),
        ],
        preferredOrder: community.channels,
      }),
    );
  }

  public static fromChannels(
    channels: CommunityChannel[],
  ): CommunityChannelCollection {
    return new CommunityChannelCollection([...channels]);
  }

  public static isText(
    channel: CommunityChannel,
  ): channel is CommunityTextChannel {
    return channel.type === 'text';
  }

  public static isVoice(
    channel: CommunityChannel,
  ): channel is CommunityVoiceChannel {
    return channel.type === 'voice';
  }

  private constructor(private readonly orderedChannels: CommunityChannel[]) {}

  public all(): CommunityChannel[] {
    return [...this.orderedChannels];
  }

  public findById(channelId: string): CommunityChannel | undefined {
    return this.orderedChannels.find((channel) => channel.id === channelId);
  }

  public has(channelId: string): boolean {
    return this.findById(channelId) !== undefined;
  }

  public text(): CommunityTextChannel[] {
    return this.orderedChannels.filter(CommunityChannelCollection.isText);
  }

  public voice(): CommunityVoiceChannel[] {
    return this.orderedChannels.filter(CommunityChannelCollection.isVoice);
  }

  public split(): {
    channels: CommunityChannel[];
    textChannels: CommunityTextChannel[];
    voiceChannels: CommunityVoiceChannel[];
  } {
    return {
      channels: this.all(),
      textChannels: this.text(),
      voiceChannels: this.voice(),
    };
  }
}
