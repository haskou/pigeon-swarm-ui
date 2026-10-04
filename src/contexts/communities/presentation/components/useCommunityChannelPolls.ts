import { useCallback, useMemo, useState } from 'react';

import type { PollResource } from '../../../../shared/domain/pigeonResources.types';

type UseCommunityChannelPollsResult = {
  selectedChannelPolls: PollResource[];
  upsertPoll: (poll: PollResource) => void;
};

export function useCommunityChannelPolls(
  communityId: string,
  selectedChannelId: null | string,
): UseCommunityChannelPollsResult {
  const [polls, setPolls] = useState<PollResource[]>([]);
  const selectedChannelPolls = useMemo(
    () =>
      selectedChannelId
        ? polls.filter(
            (poll) =>
              poll.scope.type === 'community_channel' &&
              poll.scope.communityId === communityId &&
              poll.scope.channelId === selectedChannelId,
          )
        : [],
    [communityId, polls, selectedChannelId],
  );
  const upsertPoll = useCallback((poll: PollResource) => {
    setPolls((current) =>
      [...current.filter((item) => item.id !== poll.id), poll].sort(
        (left, right) => left.createdAt - right.createdAt,
      ),
    );
  }, []);

  return { selectedChannelPolls, upsertPoll };
}
