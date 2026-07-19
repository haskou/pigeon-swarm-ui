import type { NotificationScopeSettingResource } from '../../infrastructure/http/resources/NotificationScopeSettingResource';

export type NotificationSettingMap = Record<
  string,
  NotificationScopeSettingResource
>;
