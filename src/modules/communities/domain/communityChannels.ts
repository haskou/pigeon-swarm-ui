import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../shared/domain/pigeonResources.types';

export class CommunityChannels {
  public static all(community: Community): CommunityChannel[] {
    return [...community.textChannels, ...(community.voiceChannels ?? [])];
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
    textChannels: CommunityTextChannel[];
    voiceChannels: CommunityVoiceChannel[];
  } {
    return {
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
