import type { RecipientMailboxAttempt } from './RecipientMailboxAttempt';

import { MailboxUnavailableError } from '../../mailboxes/domain/errors/MailboxUnavailableError';

/**
 * Classifies failed appends and settles recipient delivery once the verified
 * home has not delivered. An unavailable mailbox is an absent inbox;
 * any other failure is a fault. The local node is the fallback. A home fault
 * is kept and rethrown only when the local node also answers absent, so a
 * real delivery failure is never read as a benign missing inbox. Any other
 * local failure is rethrown unchanged.
 */
export class RecipientMailboxRoutingPolicy {
  /** The attempt outcome of an append that failed with `error`. */
  public static failed<T>(
    error: unknown,
  ): Exclude<RecipientMailboxAttempt<T>, { kind: 'delivered' }> {
    return error instanceof MailboxUnavailableError
      ? { error, kind: 'absent' }
      : { error, kind: 'faulted' };
  }

  public static resolve<T>(
    home: Exclude<RecipientMailboxAttempt<T>, { kind: 'delivered' }>,
    local: RecipientMailboxAttempt<T>,
  ): T {
    if (local.kind === 'delivered') return local.value;

    if (home.kind === 'faulted' && local.kind === 'absent') throw home.error;

    throw local.error;
  }
}
