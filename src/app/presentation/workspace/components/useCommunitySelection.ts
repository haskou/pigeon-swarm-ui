import { useMemo } from 'react';

import type { Community } from '../../../../shared/domain/pigeonResources.types';

import { CommunityChannels } from '../../../../contexts/communities/domain/CommunityChannels';
import { CommunityList } from '../../../../contexts/communities/presentation/view-models/CommunityList';

export function useCommunitySelection({
  activeCommunityId,
  communities,
  communityChannelById,
}: {
  activeCommunityId?: null | string;
  communities: Community[];
  communityChannelById: Record<string, string>;
}) {
  const selectableCommunities = useMemo(
    () => CommunityList.withUniqueIds(communities),
    [communities],
  );
  const activeCommunity = useMemo(
    () =>
      selectableCommunities.find(
        (community) => community.id === activeCommunityId,
      ) ?? selectableCommunities[0],
    [activeCommunityId, selectableCommunities],
  );
  const activeCommunityTextChannels = useMemo(
    () => (activeCommunity ? CommunityChannels.text(activeCommunity) : []),
    [activeCommunity],
  );
  const activeCommunityChannelId = useMemo(() => {
    if (!activeCommunity) return null;

    const storedId = communityChannelById[activeCommunity.id];

    return storedId &&
      activeCommunityTextChannels.some((channel) => channel.id === storedId)
      ? storedId
      : (activeCommunityTextChannels[0]?.id ?? null);
  }, [activeCommunity, activeCommunityTextChannels, communityChannelById]);

  return {
    activeCommunity,
    activeCommunityChannelId,
    activeCommunityTextChannels,
  };
}
