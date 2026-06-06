import { useMemo } from 'react';

import type { Community } from '../../../../shared/domain/pigeonResources.types';

import { CommunityChannels } from '../../../../contexts/communities/domain/CommunityChannels';

export function useCommunitySelection({
  activeCommunityId,
  communities,
  communityChannelById,
}: {
  activeCommunityId?: null | string;
  communities: Community[];
  communityChannelById: Record<string, string>;
}) {
  const activeCommunity = useMemo(
    () =>
      communities.find((community) => community.id === activeCommunityId) ??
      communities[0],
    [activeCommunityId, communities],
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
