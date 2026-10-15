/**
 * A group control letter as the node serves it: it names no conversation,
 * which travels only inside the sealed key.
 */
export type GroupConversationInvitationPayload = {
  encryptedConversationKey: string;
  inviterIdentityId: string;
  nonce: string;
  recipientIdentityId: string;
};
