import type { NotificationLevel } from './NotificationLevel';
import type { NotificationSettingScope } from './NotificationSettingScope';

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
