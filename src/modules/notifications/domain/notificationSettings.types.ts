export type NotificationLevel = 'all' | 'mentions' | 'none';

export type NotificationSettingScope =
  | {
      conversationId: string;
      type: 'conversation';
    }
  | {
      communityId: string;
      type: 'community';
    }
  | {
      channelId: string;
      communityId: string;
      type: 'community_channel';
    };

export type NotificationScopeSetting = {
  hideMutedChannels: boolean;
  mobilePushEnabled: boolean;
  mutedUntil?: null | number;
  notificationLevel: NotificationLevel;
  scope: NotificationSettingScope;
  suppressEveryoneAndHere: boolean;
  suppressRoleMentions: boolean;
  updatedAt?: number;
};

export type NotificationScopeSettingsResource = {
  scopes: NotificationScopeSetting[];
};

export type NotificationScopeSettingInput = Omit<
  NotificationScopeSetting,
  'updatedAt'
>;

export type NotificationSettingMap = Record<string, NotificationScopeSetting>;

export type NotificationMentionContext = {
  currentIdentityId: string;
  currentRoleIds?: string[];
  mentionedIdentityIds?: string[];
  mentionedRoleIds?: string[];
  mentionedRoleMemberIds?: string[];
  mentionsEveryoneOrHere?: boolean;
};
