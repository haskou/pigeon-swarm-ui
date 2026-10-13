/** `retry` is the wait after an absent peer inbox. It is in memory only. */
export type DirectMessageOutboxState = 'failed' | 'pending' | 'retry';
