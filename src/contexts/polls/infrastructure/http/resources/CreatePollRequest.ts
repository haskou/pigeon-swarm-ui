import type { PollOptionResource } from './PollOptionResource';

export type CreatePollRequest =
  | {
      allowsMultipleVotes: boolean;
      channelId: string;
      communityId: string;
      createdAt: number;
      expiresAt?: null | number;
      options: PollOptionResource[];
      pollId: string;
      question: string;
      scopeType: 'community_channel';
    }
  | {
      allowsMultipleVotes: boolean;
      conversationId: string;
      createdAt: number;
      expiresAt?: null | number;
      options: PollOptionResource[];
      pollId: string;
      question: string;
      scopeType: 'group_conversation';
    };
