/**
 * What a received control record did; `deferred` waits for the user to
 * accept or decline it.
 */
export type GroupMailboxControlOutcome =
  | 'applied'
  | 'deferred'
  | 'ignored'
  | 'rejected';
