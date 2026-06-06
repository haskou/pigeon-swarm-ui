export type RealtimeTypingInput =
  | {
      active: boolean;
      conversationId: string;
      scope: 'conversation';
    }
  | {
      active: boolean;
      channelId: string;
      communityId: string;
      scope: 'community_channel';
    };
