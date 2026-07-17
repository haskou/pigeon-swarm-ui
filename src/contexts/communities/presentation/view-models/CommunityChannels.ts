import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityChannelCollection } from './CommunityChannelCollection';

export class CommunityChannels {
  public static collection(community: Community): CommunityChannelCollection {
    return CommunityChannelCollection.fromCommunity(community);
  }

  public static all(community: Community): CommunityChannel[] {
    return CommunityChannels.collection(community).all();
  }

  public static find(
    community: Community,
    channelId: string,
  ): CommunityChannel | undefined {
    return CommunityChannels.collection(community).findById(channelId);
  }

  public static has(community: Community, channelId: string): boolean {
    return CommunityChannels.collection(community).has(channelId);
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
    return CommunityChannelCollection.fromChannels(channels).split();
  }

  public static text(community: Community): CommunityTextChannel[] {
    return CommunityChannels.collection(community).text();
  }

  public static voice(community: Community): CommunityVoiceChannel[] {
    return CommunityChannels.collection(community).voice();
  }
}
