import type {
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface SaveNotificationSettingPort {
  saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting>;
}
