import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';

export class CommunityList {
  public static prepending(
    communities: Community[],
    community: Community,
  ): Community[] {
    return [
      community,
      ...communities.filter((candidate) => candidate.id !== community.id),
    ];
  }

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

  public static updating(
    communities: Community[],
    communityId: string,
    updater: (community: Community) => Community,
  ): Community[] {
    return communities.map((community) =>
      community.id === communityId ? updater(community) : community,
    );
  }

  public static without(
    communities: Community[],
    communityId: string,
  ): Community[] {
    return communities.filter((community) => community.id !== communityId);
  }
}
