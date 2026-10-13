/** One pending append: the recipient's inbox and the envelope id it gets. */
export type GroupMailboxOutboxCopy = {
  readonly envelopeId: string;
  readonly identityId: string;
};
