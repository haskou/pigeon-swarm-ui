import type { PollOptionResource } from './PollOptionResource';

export type CreatePollRequest =
  | {
      allowsMultipleVotes: boolean;
      channelId: string;
      communityId: string;
      expiresAt?: null | number;
      options: PollOptionResource[];
      question: string;
      scopeType: 'community_channel';
    }
  | {
      allowsMultipleVotes: boolean;
      conversationId: string;
      expiresAt?: null | number;
      options: PollOptionResource[];
      question: string;
      scopeType: 'group_conversation';
    };
