import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ChatMessage,
  CommunityChannel,
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { CommunityChannelThreadCache } from '../view-models/CommunityChannelThreadCache';
import {
  hiddenCommunityThreadSummaryKeysFromMessages,
  visibleCommunityThreadSummaries,
} from './communityThreadState';
import { useCommunityThreadRootLabels } from './useCommunityThreadRootLabels';

type UseCommunityChannelThreadsInput = {
  channelTopologyKey: string;
  communityId: string;
  messages: ChatMessage[];
  onCommunityChannelsUpdated: (
    communityId: string,
    channels: CommunityChannel[],
  ) => void;
  projectChannelMessages: (
    channelId: string,
    rawMessages: MessageResource[],
  ) => Promise<ChatMessage[]>;
  selectedChannelId: null | string;
  session: Session;
  textChannels: CommunityTextChannel[];
};

type UseCommunityChannelThreadsResult = {
  addThreadRootLabels: (labels: Record<string, string>) => void;
  channelThreadsByChannelId: Record<string, CommunityChannelThreadSummary[]>;
  textChannelsWithThreads: CommunityTextChannel[];
  threadRootLabels: Record<string, string>;
  upsertChannelThreadSummary: (
    channelId: string,
    summary: CommunityChannelThreadSummary,
  ) => void;
};

const communityChannelThreadCache = new CommunityChannelThreadCache();

export function useCommunityChannelThreads({
  channelTopologyKey,
  communityId,
  messages,
  onCommunityChannelsUpdated,
  projectChannelMessages,
  selectedChannelId,
  session,
  textChannels,
}: UseCommunityChannelThreadsInput): UseCommunityChannelThreadsResult {
  const [channelThreadsByChannelId, setChannelThreadsByChannelId] = useState<
    Record<string, CommunityChannelThreadSummary[]>
  >(() => CommunityChannelThreadCache.fromChannels(textChannels));
  const textChannelsWithThreadSummaries = useMemo(
    () =>
      textChannels.map((channel) => ({
        ...channel,
        threads: channelThreadsByChannelId[channel.id] ?? channel.threads ?? [],
      })),
    [channelThreadsByChannelId, textChannels],
  );
  const {
    add: addThreadRootLabels,
    hiddenKeys: hiddenThreadRootLabelKeys,
    hide: hideThreadRootLabels,
    labels: threadRootLabels,
    reveal: revealThreadRootLabel,
  } = useCommunityThreadRootLabels({
    channels: textChannelsWithThreadSummaries,
    communityId,
    projectMessages: projectChannelMessages,
    session,
  });
  const textChannelsWithThreads = useMemo(
    () =>
      textChannelsWithThreadSummaries.map((channel) => ({
        ...channel,
        threads: visibleCommunityThreadSummaries({
          channelId: channel.id,
          hiddenThreadRootLabelKeys,
          threads: channel.threads ?? [],
        }),
      })),
    [hiddenThreadRootLabelKeys, textChannelsWithThreadSummaries],
  );
  const upsertChannelThreadSummary = useCallback(
    (channelId: string, summary: CommunityChannelThreadSummary) => {
      revealThreadRootLabel(channelId, summary.rootMessageId);
      setChannelThreadsByChannelId((current) =>
        CommunityChannelThreadCache.upsertSummary(current, channelId, summary),
      );
    },
    [revealThreadRootLabel],
  );

  useEffect(() => {
    setChannelThreadsByChannelId(
      CommunityChannelThreadCache.fromChannels(textChannels),
    );
  }, [communityId, textChannels]);
  useEffect(() => {
    const cached = communityChannelThreadCache.read(communityId);

    if (cached) {
      setChannelThreadsByChannelId(cached);
    }

    let cancelled = false;

    const cancelIdleWork = runWhenBrowserIdle(() => {
      void applicationContainer.communities
        .listChannels(session, communityId)
        .then((channels) => {
          if (cancelled) return;

          onCommunityChannelsUpdated(communityId, channels);
          const threadsByChannelId = CommunityChannelThreadCache.fromChannels(
            channels.filter((channel) => channel.type === 'text'),
          );

          communityChannelThreadCache.write(communityId, threadsByChannelId);
          setChannelThreadsByChannelId(threadsByChannelId);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [channelTopologyKey, communityId, onCommunityChannelsUpdated, session]);
  useEffect(() => {
    if (!selectedChannelId) return;

    const channelThreads = channelThreadsByChannelId[selectedChannelId] ?? [];

    if (channelThreads.length === 0) return;

    const hiddenKeys = hiddenCommunityThreadSummaryKeysFromMessages({
      channelId: selectedChannelId,
      messages,
      threads: channelThreads,
    });

    if (hiddenKeys.length === 0) return;

    hideThreadRootLabels(hiddenKeys);
  }, [
    channelThreadsByChannelId,
    hideThreadRootLabels,
    messages,
    selectedChannelId,
  ]);

  return {
    addThreadRootLabels,
    channelThreadsByChannelId,
    textChannelsWithThreads,
    threadRootLabels,
    upsertChannelThreadSummary,
  };
}
