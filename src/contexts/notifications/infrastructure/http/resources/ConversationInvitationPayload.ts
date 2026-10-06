export type ConversationInvitationPayload = {
  conversationId: string;
  encryptedConversationKey: string;
  inviterIdentityId: string;
  nonce: string;
  recipientIdentityId: string;
};
