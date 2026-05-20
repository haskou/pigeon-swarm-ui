import type {
  Community,
  CommunityChannel,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../shared/domain/pigeonResources.types';

export function isCommunityTextChannel(
  channel: CommunityChannel,
): channel is CommunityTextChannel {
  return channel.type === 'text';
}

export function isCommunityVoiceChannel(
  channel: CommunityChannel,
): channel is CommunityVoiceChannel {
  return channel.type === 'voice';
}

export function communityChannels(community: Community): CommunityChannel[] {
  return [...community.textChannels, ...(community.voiceChannels ?? [])];
}

export function communityTextChannels(
  community: Community,
): CommunityTextChannel[] {
  return communityChannels(community).filter(isCommunityTextChannel);
}

export function communityVoiceChannels(
  community: Community,
): CommunityVoiceChannel[] {
  return communityChannels(community).filter(isCommunityVoiceChannel);
}

export function splitCommunityChannels(channels: CommunityChannel[]): {
  textChannels: CommunityTextChannel[];
  voiceChannels: CommunityVoiceChannel[];
} {
  return {
    textChannels: channels.filter(isCommunityTextChannel),
    voiceChannels: channels.filter(isCommunityVoiceChannel),
  };
}
