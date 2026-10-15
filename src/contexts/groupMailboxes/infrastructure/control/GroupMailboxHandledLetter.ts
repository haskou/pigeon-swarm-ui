import type { GroupMailboxLetterState } from './GroupMailboxLetterState';

/** What this device holds about one control letter it handles or handled. */
export type GroupMailboxHandledLetter = {
  /** The notification that carried the letter when this device took it. */
  notificationId: string;
  /** The state record decided for it; absent while it is being handled. */
  state?: GroupMailboxLetterState;
  /** When the entry may be pruned (ms since the epoch). */
  until: number;
};
