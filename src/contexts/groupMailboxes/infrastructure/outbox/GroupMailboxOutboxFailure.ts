/**
 * A group record given up after the outbox expiry. `reference` is the id the
 * caller enqueued it under.
 */
export type GroupMailboxOutboxFailure = {
  readonly conversationId: string;
  readonly reference: string;
};
