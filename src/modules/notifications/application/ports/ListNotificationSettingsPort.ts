import type {
  NotificationScopeSetting,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListNotificationSettingsPort {
  listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]>;
}
