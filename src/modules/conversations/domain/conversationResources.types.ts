export type ConversationKeyEntry = {
  conversationId: string;
  createdAt: number;
  peerIdentityId: string;
  privateKey: string;
  publicKey: string;
};

export type ConversationInvitationPayload = {
  conversationId: string;
  encryptedConversationKey: string;
  inviterIdentityId: string;
  inviterSignature: string;
  recipientIdentityId: string;
};

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
