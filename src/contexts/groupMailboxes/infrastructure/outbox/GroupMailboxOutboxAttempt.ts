import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
import type { GroupMailboxOutboxRow } from './GroupMailboxOutboxRow';

/**
 * One queued row as a pass attempts it: `current` is the row re-encrypted
 * when its generation was superseded, `row` the one queued before. Without
 * a generation it is not sent this pass and only holds back its recipients.
 */
export type GroupMailboxOutboxAttempt = {
  readonly current: GroupMailboxOutboxRow;
  readonly generation?: GroupMailboxGeneration;
  readonly row: GroupMailboxOutboxRow;
};
