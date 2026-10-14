import type { DirectRecordBase } from './DirectRecordBase';

/**
 * A vote on a group poll. Applied last-writer-wins per voter by createdAt;
 * no option ids removes the vote.
 */
export type DirectPollVoteRecord = DirectRecordBase & {
  optionIds: string[];
  targetPollId: string;
  type: 'poll_vote';
};
