import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../shared/domain/pigeonResources.types';

export class CommunityChannels {
  public static all(community: Community): CommunityChannel[] {
    const currentChannels = [
      ...community.textChannels,
      ...(community.voiceChannels ?? []),
    ];

    if (!community.channels) return currentChannels;

    const channelsById = new Map(
      currentChannels.map((channel) => [channel.id, channel]),
    );
    const orderedChannels: CommunityChannel[] = [];

    for (const channel of community.channels) {
      const currentChannel = channelsById.get(channel.id);

      if (!currentChannel) continue;

      orderedChannels.push(currentChannel);
      channelsById.delete(channel.id);
    }

    return [...orderedChannels, ...channelsById.values()];
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

  public static split(channels: CommunityChannel[]): {
    channels: CommunityChannel[];
    textChannels: CommunityTextChannel[];
    voiceChannels: CommunityVoiceChannel[];
  } {
    return {
      channels,
      textChannels: channels.filter(CommunityChannels.isText),
      voiceChannels: channels.filter(CommunityChannels.isVoice),
    };
  }

  public static text(community: Community): CommunityTextChannel[] {
    return CommunityChannels.all(community).filter(CommunityChannels.isText);
  }

  public static voice(community: Community): CommunityVoiceChannel[] {
    return CommunityChannels.all(community).filter(CommunityChannels.isVoice);
  }
}
