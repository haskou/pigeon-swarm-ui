/**
 * What this device knows of one group conversation from its stored history:
 * the creation time of the newest message and how many messages of other
 * members arrived since it was last read here.
 */
export type GroupConversationActivity = {
  latestMessageAt: number | undefined;
  unreadCount: number;
};
