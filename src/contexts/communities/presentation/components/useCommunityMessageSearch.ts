import { useCallback, useState } from 'react';

import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type {
  CommunityMessageSearchResultItem,
  CommunityMessageSearchScope,
} from './CommunityMessageSearchPanel';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type ProjectChannelMessage = (
  channelId: string,
  rawMessage: MessageResource,
) => Promise<ChatMessage>;

type UseCommunityMessageSearchInput = {
  channelNameFor: (channelId: string) => string;
  communityId: string;
  communityIsPublic: boolean;
  onResultClick: (result: CommunityMessageSearchResultItem) => void;
  projectChannelMessage: ProjectChannelMessage;
  selectedChannelId: null | string;
  session: Session;
};

export function useCommunityMessageSearch({
  channelNameFor,
  communityId,
  communityIsPublic,
  onResultClick,
  projectChannelMessage,
  selectedChannelId,
  session,
}: UseCommunityMessageSearchInput) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityMessageSearchResultItem[]>(
    [],
  );
  const [searched, setSearched] = useState(false);
  const [scope, setScope] =
    useState<CommunityMessageSearchScope>('channel');
  const [state, setState] = useState<'idle' | 'loading'>('idle');

  const changeQuery = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    setSearched(false);
  }, []);
  const changeScope = useCallback((nextScope: CommunityMessageSearchScope) => {
    setScope(nextScope);
    setSearched(false);
  }, []);
  const submit = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!communityIsPublic || !trimmedQuery) return;

    setState('loading');
    setError(null);
    setSearched(true);
    try {
      const result =
        scope === 'channel' && selectedChannelId
          ? await applicationContainer.searchCommunityChannelMessages(
              session,
              communityId,
              selectedChannelId,
              { limit: 20, query: trimmedQuery },
            )
          : await applicationContainer.searchCommunityMessages(
              session,
              communityId,
              { limit: 20, query: trimmedQuery },
            );
      const projectedResults = await Promise.all(
        result.messages.map(async (message) => {
          const channelId =
            message.channelId ?? result.channelId ?? selectedChannelId;

          if (!channelId) return null;

          return {
            channelId,
            channelName: channelNameFor(channelId),
            message: await projectChannelMessage(channelId, message),
          };
        }),
      );

      setResults(
        projectedResults.filter(
          (item): item is CommunityMessageSearchResultItem => Boolean(item),
        ),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.searchMessagesError));
      setResults([]);
    } finally {
      setState('idle');
    }
  }, [
    channelNameFor,
    communityId,
    communityIsPublic,
    projectChannelMessage,
    query,
    scope,
    selectedChannelId,
    session,
  ]);

  return {
    error,
    onResultClick,
    open,
    query,
    results,
    scope,
    searched,
    setOpen,
    setQuery: changeQuery,
    setScope: changeScope,
    state,
    submit,
  };
}
