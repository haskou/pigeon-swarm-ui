export type NotificationSettingScopeResource =
  | { conversationId: string; type: 'conversation' }
  | { communityId: string; type: 'community' }
  | {
      channelId: string;
      communityId: string;
      type: 'community_channel';
    };
