import { useCallback, useMemo, useState } from 'react';

import type { ConversationResource } from '../../domain/types';

import { sortConversationsByLatestMessage } from '../../domain/conversations/conversationOrdering';

type UnreadMessagesByConversation = Record<string, string[]>;

type ConversationWithUnread = ConversationResource & {
  unreadCount: number;
};

export function useUnreadMessages(conversations: ConversationResource[]): {
  clearUnreadMessages: (conversationId: string) => void;
  conversationsWithUnread: ConversationWithUnread[];
  markUnreadMessage: (conversationId: string, messageId: string) => void;
} {
  const [unreadMessages, setUnreadMessages] =
    useState<UnreadMessagesByConversation>({});

  const conversationsWithUnread = useMemo(
    () =>
      sortConversationsByLatestMessage(
        conversations.map((conversation) => ({
          ...conversation,
          unreadCount: Math.max(
            conversation.unreadCount ?? 0,
            unreadMessages[conversation.id]?.length ?? 0,
          ),
        })),
      ),
    [conversations, unreadMessages],
  );

  const clearUnreadMessages = useCallback((conversationId: string) => {
    setUnreadMessages((current) => {
      if (!current[conversationId]?.length) return current;

      const next = { ...current };

      delete next[conversationId];

      return next;
    });
  }, []);

  const markUnreadMessage = useCallback(
    (conversationId: string, messageId: string) => {
      setUnreadMessages((current) => {
        const messages = current[conversationId] ?? [];

        if (messages.includes(messageId)) return current;

        return {
          ...current,
          [conversationId]: [...messages, messageId],
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
