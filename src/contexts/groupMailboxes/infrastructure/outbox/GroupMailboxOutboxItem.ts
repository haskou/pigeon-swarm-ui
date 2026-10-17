/**
 * One record still queued: `held` while a removal is pending in its group
 * or this device awaits the group's confirmation, `retry` once an attempt
 * left a copy undelivered, `failed` once the outbox gave up on a message
 * until it is retried, `pending` otherwise.
 */
export type GroupMailboxOutboxItem = {
  reference: string;
  state: 'failed' | 'held' | 'pending' | 'retry';
};
