/**
 * Outcome of one append attempt to a recipient mailbox. `absent` means the
 * target has no inbox for the recipient (no published home, or a 404).
 * `faulted` is any other failure. `error` carries the original failure so it
 * can be rethrown unchanged.
 */
export type RecipientMailboxAttempt<T> =
  | { error?: unknown; kind: 'absent' }
  | { kind: 'delivered'; value: T }
  | { error: unknown; kind: 'faulted' };
