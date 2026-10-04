export type ConversationResource = {
  id: string;
  /** Derived locally from loaded messages; the node never sends it. */
  latestMessageAt?: number;
  /** Standalone groups only. */
  name?: string;
  networkId: string;
  participantIds: string[];
  type: 'group' | 'one-to-one';
  unreadCount: number;
};
