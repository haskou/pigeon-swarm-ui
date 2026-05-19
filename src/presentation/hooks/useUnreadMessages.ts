import { useCallback, useMemo, useRef, useState } from 'react';

import type { ConversationResource } from '../../domain/types';

import { sortConversationsByLatestMessage } from '../../domain/conversations/conversationOrdering';

type UnreadCountsByConversation = Record<string, number>;

type ConversationWithUnread = ConversationResource & {
  unreadCount: number;
};

export function useUnreadMessages(conversations: ConversationResource[]): {
  clearUnreadMessages: (conversationId: string) => void;
  conversationsWithUnread: ConversationWithUnread[];
  markUnreadMessage: (conversationId: string, messageId: string) => void;
} {
  const seenUnreadMessageIdsRef = useRef<Record<string, Set<string>>>({});
  const [unreadCounts, setUnreadCounts] = useState<UnreadCountsByConversation>(
    {},
  );

  const conversationsWithUnread = useMemo(
    () =>
      sortConversationsByLatestMessage(
        conversations.map((conversation) => ({
          ...conversation,
          unreadCount: Math.max(
            conversation.unreadCount ?? 0,
            unreadCounts[conversation.id] ?? 0,
          ),
        })),
      ),
    [conversations, unreadCounts],
  );

  const clearUnreadMessages = useCallback((conversationId: string) => {
    delete seenUnreadMessageIdsRef.current[conversationId];
    setUnreadCounts((current) => {
      if (!current[conversationId]) return current;

      const next = { ...current };

      delete next[conversationId];

      return next;
    });
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

  return {
    clearUnreadMessages,
    conversationsWithUnread,
    markUnreadMessage,
  };
}
