import type { DirectRecordBase } from './DirectRecordBase';

/** Closes a group poll. Only its creator may write it. */
export type DirectPollCloseRecord = DirectRecordBase & {
  targetPollId: string;
  type: 'poll_close';
};
