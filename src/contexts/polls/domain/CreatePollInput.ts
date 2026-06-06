import type { PollOption } from './PollOption';

export type CreatePollInput =
  | {
      allowsMultipleVotes: boolean;
      channelId: string;
      communityId: string;
      expiresAt?: null | number;
      options: PollOption[];
      question: string;
      scopeType: 'community_channel';
    }
  | {
      allowsMultipleVotes: boolean;
      conversationId: string;
      expiresAt?: null | number;
      options: PollOption[];
      question: string;
      scopeType: 'group_conversation';
    };
