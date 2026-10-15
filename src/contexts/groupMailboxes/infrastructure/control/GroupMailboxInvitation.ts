/**
 * A key-package request from an identity that is not a contact, waiting for
 * the user to accept or decline it as an invitation to the conversation.
 */
export type GroupMailboxInvitation = {
  conversationId: string;
  inviterIdentityId: string;
  notificationId: string;
  /** When the inviter sealed the request (ms since the epoch). */
  sentAt: number;
};
