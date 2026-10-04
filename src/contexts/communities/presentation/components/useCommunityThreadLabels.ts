import { useEffect, useMemo } from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityMessageSearchResultItem } from './CommunityMessageSearchPanel';
import type { CommunityThreadState } from './communityThreadState';

import { CommunityThreadLabelIndex } from '../view-models/CommunityThreadLabelIndex';

type UseCommunityThreadLabelsInput = {
  addThreadRootLabels: (labels: Record<string, string>) => void;
  collectionMessages: ChatMessage[] | undefined;
  messages: ChatMessage[];
  searchResults: CommunityMessageSearchResultItem[];
  threadPanel: CommunityThreadState | null;
  threadRootLabels: Record<string, string>;
};

export function useCommunityThreadLabels({
  addThreadRootLabels,
  collectionMessages,
  messages,
  searchResults,
  threadPanel,
  threadRootLabels,
}: UseCommunityThreadLabelsInput): Record<string, string> {
  useEffect(() => {
    const knownRootLabels = CommunityThreadLabelIndex.fromVisibleMessages({
      collectionMessages: collectionMessages ?? [],
      messages,
      searchResultMessages: searchResults.map((result) => result.message),
      threadPanel,
    });

    if (Object.keys(knownRootLabels).length === 0) return;

    addThreadRootLabels(knownRootLabels);
  }, [
    addThreadRootLabels,
    collectionMessages,
    messages,
    searchResults,
    threadPanel,
  ]);

  return useMemo(
    () =>
      CommunityThreadLabelIndex.byRootMessageId({
        knownLabels: threadRootLabels,
        messages,
        threadPanel,
      }),
    [messages, threadPanel, threadRootLabels],
  );
}
