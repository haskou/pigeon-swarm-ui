export type PollScope =
  | {
      channelId: string;
      communityId: string;
      networkId: string;
      type: 'community_channel';
    }
  | {
      conversationId: string;
      networkId: string;
      type: 'group_conversation';
    };

export type PollOption = {
  id: string;
  text: string;
};

export type PollVote = {
  createdAt: number;
  optionIds: string[];
  voterIdentityId: string;
};

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
