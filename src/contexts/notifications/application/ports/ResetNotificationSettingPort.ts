import type {
  NotificationSettingScope,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ResetNotificationSettingPort {
  resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void>;
}
