import type { PollOption } from './PollOption';
import type { PollScope } from './PollScope';
import type { PollVote } from './PollVote';

export type PollResource = {
  allowsMultipleVotes: boolean;
  createdAt: number;
  creatorIdentityId: string;
  expiresAt?: number | null;
  id: string;
  options: PollOption[];
  question: string;
  scope: PollScope;
  status: 'closed' | 'open';
  votes: PollVote[];
};
