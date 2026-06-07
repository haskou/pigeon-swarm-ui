export type CallScope =
  | {
      conversationId: string;
      type: 'conversation';
    }
  | {
      channelId: string;
      communityId: string;
      type: 'community_channel';
    };
