/**
 * One accepted application record of a group conversation, kept on this
 * device because its inbox copy is acknowledged. `conversation` and
 * `record` are keyed tags of the conversation and record ids, so neither id
 * is readable at rest; `sealed` holds the record, whose `authorId` is the
 * MLS sender.
 */
export type GroupMessageHistoryRow = {
  readonly conversation: string;
  readonly identityId: string;
  readonly record: string;
  readonly sealed: Uint8Array;
};
