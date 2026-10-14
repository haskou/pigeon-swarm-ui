import type { PollVoteSnapshot } from './PollVoteSnapshot';

/** What a poll shows: its definition, whether it is open and its votes. */
export type PollSnapshot = {
  allowsMultipleVotes: boolean;
  createdAt: number;
  creatorIdentityId: string;
  expiresAt?: null | number;
  id: string;
  options: { id: string; text: string }[];
  question: string;
  status: 'closed' | 'open';
  votes: PollVoteSnapshot[];
};
