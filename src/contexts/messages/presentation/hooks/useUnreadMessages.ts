import { useCallback, useMemo, useRef, useState } from 'react';

import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { UnreadMessages } from './UnreadMessages';

import { ConversationTimeline } from '../../../conversations/presentation/view-models/ConversationTimeline';

type UnreadCountsByConversation = Record<string, number>;

export function useUnreadMessages(
  conversations: ConversationResource[],
): UnreadMessages {
  const seenUnreadMessageIdsRef = useRef<Record<string, Set<string>>>({});
  const [unreadCounts, setUnreadCounts] = useState<UnreadCountsByConversation>(
    {},
  );
  const [groupCounts, setGroupCounts] = useState<UnreadCountsByConversation>(
    {},
  );

  const conversationsWithUnread = useMemo(
    () =>
      ConversationTimeline.sortByLatestMessage(
        conversations.map((conversation) => ({
          ...conversation,
          unreadCount:
            (unreadCounts[conversation.id] ?? 0) +
            (groupCounts[conversation.id] ?? 0),
        })),
      ),
    [conversations, groupCounts, unreadCounts],
  );

  const clearUnreadMessages = useCallback((conversationId: string) => {
    delete seenUnreadMessageIdsRef.current[conversationId];
    const without = (current: UnreadCountsByConversation) => {
      if (!current[conversationId]) return current;

      const next = { ...current };

      delete next[conversationId];

      return next;
    };

    setUnreadCounts(without);
    setGroupCounts(without);
  }, []);

  const markUnreadMessage = useCallback(
    (conversationId: string, messageId: string) => {
      const seenUnreadMessageIds =
        seenUnreadMessageIdsRef.current[conversationId] ?? new Set<string>();

      if (seenUnreadMessageIds.has(messageId)) return;

      seenUnreadMessageIds.add(messageId);
      seenUnreadMessageIdsRef.current[conversationId] = seenUnreadMessageIds;
      setUnreadCounts((current) => {
        return {
          ...current,
          [conversationId]: (current[conversationId] ?? 0) + 1,
        };
      });
    },
    [],
  );

  const setGroupUnread = useCallback(
    (conversationId: string, count: number) => {
      setGroupCounts((current) => {
        if ((current[conversationId] ?? 0) === count) return current;

        const next = { ...current };

        if (count > 0) next[conversationId] = count;
        else delete next[conversationId];

        return next;
      });
    },
    [],
  );

  return {
    clearUnreadMessages,
    conversationsWithUnread,
    markUnreadMessage,
    setGroupUnread,
  };
}
