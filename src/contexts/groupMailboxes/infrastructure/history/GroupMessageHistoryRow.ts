import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';

/**
 * One accepted application record of a group conversation, kept on this
 * device because its inbox copy is acknowledged. `record.authorId` is the
 * MLS sender.
 */
export type GroupMessageHistoryRow = {
  readonly id: string;
  readonly record: DirectMessageRecord;
};
