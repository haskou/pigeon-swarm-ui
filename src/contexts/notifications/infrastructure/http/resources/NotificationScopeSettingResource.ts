import type { NotificationLevelResource } from './NotificationLevelResource';
import type { NotificationSettingScopeResource } from './NotificationSettingScopeResource';

export type NotificationScopeSettingResource = {
  hideMutedChannels: boolean;
  mobilePushEnabled: boolean;
  mutedUntil?: null | number;
  notificationLevel: NotificationLevelResource;
  scope: NotificationSettingScopeResource;
  suppressEveryoneAndHere: boolean;
  suppressRoleMentions: boolean;
  updatedAt?: number;
};
