import type { PollOptionResource } from './PollOptionResource';
import type { PollScopeResource } from './PollScopeResource';
import type { PollVoteResource } from './PollVoteResource';

export type PollResource = {
  allowsMultipleVotes: boolean;
  createdAt: number;
  creatorIdentityId: string;
  expiresAt?: number | null;
  id: string;
  options: PollOptionResource[];
  question: string;
  scope: PollScopeResource;
  status: 'closed' | 'open';
  votes: PollVoteResource[];
};
