/**
 * The signed body of a control record sent to one peer: who sends it to whom,
 * for which conversation and when, plus the record in base64url. The sender's
 * identity key signs every field but `signature`.
 */
export type GroupMailboxControlLetter = {
  readonly conversationId: string;
  readonly kind: 'group-mailbox-control-letter';
  readonly payload: string;
  readonly recipientIdentityId: string;
  readonly senderIdentityId: string;
  readonly sentAt: number;
  readonly signature: string;
};
