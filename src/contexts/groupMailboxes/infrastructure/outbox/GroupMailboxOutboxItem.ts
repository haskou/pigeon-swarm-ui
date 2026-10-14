/**
 * One record still queued: `held` while a removal is pending in its group,
 * `retry` once an attempt left a copy undelivered, `pending` otherwise.
 */
export type GroupMailboxOutboxItem = {
  reference: string;
  state: 'held' | 'pending' | 'retry';
};
