export type ConversationKeyEntry = {
  algorithm: 'aes-256-gcm';
  conversationId: string;
  createdAt: number;
  key: string;
  kind: 'community' | 'conversation';
  peerIdentityId: string;
  version: 2;
};
