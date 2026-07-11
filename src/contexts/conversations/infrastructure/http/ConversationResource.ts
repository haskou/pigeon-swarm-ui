export type ConversationResource = {
  id: string;
  conversationId?: string;
  latestMessageAt?: number;
  latestMessagePreview?: string;
  name?: string;
  networkId: string;
  participantIdentityIds?: string[];
  participantIds?: string[];
  participants?: string[];
  peerIdentityId?: string;
  title?: string;
  type?: 'group' | 'one-to-one';
  unreadCount?: number;
};
