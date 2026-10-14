import type { ConversationResource } from '../../infrastructure/http/ConversationResource';

/**
 * A conversation with the unread count this device keeps for it. The node
 * cannot know the read state of sealed content, so the count never comes
 * from it.
 */
export type ConversationWithUnread = ConversationResource & {
  unreadCount: number;
};
