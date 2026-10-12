import type { RecipientMailboxAttempt } from './RecipientMailboxAttempt';

/**
 * Settles recipient delivery once the verified home has not delivered. The
 * local node is the fallback. A home fault is kept and rethrown only when the
 * local node also answers absent, so a real delivery failure is never read as
 * a benign missing inbox. Any other local failure is rethrown unchanged.
 */
export class RecipientMailboxRoutingPolicy {
  public static resolve<T>(
    home: Exclude<RecipientMailboxAttempt<T>, { kind: 'delivered' }>,
    local: RecipientMailboxAttempt<T>,
  ): T {
    if (local.kind === 'delivered') return local.value;

    if (home.kind === 'faulted' && local.kind === 'absent') throw home.error;

    throw local.error;
  }
}
