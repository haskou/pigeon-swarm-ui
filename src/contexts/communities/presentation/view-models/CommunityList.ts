import type { Community } from '../../domain/Community';

export class CommunityList {
  public static preservingCommunityVoicePresence(
    community: Community,
    currentCommunity: Community,
  ): Community {
    if (!currentCommunity.voiceChannels?.length) return community;

    const currentVoiceChannelsById = new Map(
      currentCommunity.voiceChannels.map((channel) => [channel.id, channel]),
    );
    let changed = false;
    const voiceChannels = (community.voiceChannels ?? []).map((channel) => {
      const currentChannel = currentVoiceChannelsById.get(channel.id);

      if (!currentChannel?.connectedIdentityIds) return channel;

      changed = true;

      return {
        ...channel,
        connectedIdentityIds: [...currentChannel.connectedIdentityIds],
      };
    });

    return changed ? { ...community, voiceChannels } : community;
  }

  public static preservingVoicePresence(
    communities: Community[],
    currentCommunities: Community[],
  ): Community[] {
    const currentById = new Map(
      currentCommunities.map((community) => [community.id, community]),
    );

    return communities.map((community) => {
      const currentCommunity = currentById.get(community.id);

      return currentCommunity
        ? CommunityList.preservingCommunityVoicePresence(
            community,
            currentCommunity,
          )
        : community;
    });
  }

  public static withUniqueIds(communities: Community[]): Community[] {
    const seenIds = new Set<string>();
    const uniqueCommunities: Community[] = [];

    for (const community of communities) {
      if (seenIds.has(community.id)) continue;

      seenIds.add(community.id);
      uniqueCommunities.push(community);
    }

    return uniqueCommunities.length === communities.length
      ? communities
      : uniqueCommunities;
  }
}
