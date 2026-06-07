import type { NotificationScopeSetting } from './NotificationScopeSetting';

export type NotificationScopeSettingInput = Omit<
  NotificationScopeSetting,
  'updatedAt'
>;
