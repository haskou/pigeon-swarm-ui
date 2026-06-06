export type RealtimeTypingMessage =
  | {
      active: boolean;
      conversationId: string;
      identityId: string;
      scope: 'conversation';
      timestamp: number;
      type: 'typing';
    }
  | {
      active: boolean;
      channelId: string;
      communityId: string;
      identityId: string;
      scope: 'community_channel';
      timestamp: number;
      type: 'typing';
    };
