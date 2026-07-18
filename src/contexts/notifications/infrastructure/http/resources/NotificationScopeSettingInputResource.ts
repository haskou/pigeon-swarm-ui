import type { NotificationScopeSettingResource } from './NotificationScopeSettingResource';

export type NotificationScopeSettingInputResource = Omit<
  NotificationScopeSettingResource,
  'updatedAt'
>;
