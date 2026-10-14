import type { DirectRecordBase } from './DirectRecordBase';

/** A group poll. Its record id is the poll id, owned by its creator. */
export type DirectPollRecord = DirectRecordBase & {
  allowsMultipleVotes: boolean;
  options: { id: string; text: string }[];
  question: string;
  type: 'poll';
};
