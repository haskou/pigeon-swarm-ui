import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';

/** A commit this device made, and the mailboxes it must reach. */
export interface GroupMailboxCommit {
  readonly commit: Uint8Array;
  /** For the added devices only; absent when nobody was added. */
  readonly welcome?: Uint8Array;
  /** The epoch the commit was made in. */
  readonly epoch: bigint;
  /**
   * The generation after the commit: what the group uses from now on. Its
   * secret never leaves this device; a joiner gets only its index.
   */
  readonly generation: GroupMailboxGeneration;
  /**
   * The generation whose inboxes carry the commit: the one before it, since
   * members can only learn the next generation from the commit.
   */
  readonly deliveryGeneration: GroupMailboxGeneration;
}
