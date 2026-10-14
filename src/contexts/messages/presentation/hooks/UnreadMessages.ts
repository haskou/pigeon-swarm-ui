import type { ConversationWithUnread } from '../../../conversations/presentation/view-models/ConversationWithUnread';

/**
 * The unread counts of the sidebar: messages marked as they arrive, plus a
 * group's count read from its history on this device.
 */
export type UnreadMessages = {
  clearUnreadMessages: (conversationId: string) => void;
  conversationsWithUnread: ConversationWithUnread[];
  markUnreadMessage: (conversationId: string, messageId: string) => void;
  /** Replaces a group's device count; zero removes it. */
  setGroupUnread: (conversationId: string, count: number) => void;
};
