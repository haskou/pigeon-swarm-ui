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
