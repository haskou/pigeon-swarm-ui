import type {
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NotificationDecision } from '../../domain/NotificationDecision';
import type { NotificationId } from '../../domain/NotificationId';

import { PigeonNotificationsApi } from './PigeonNotificationsApi';

export class PigeonNotificationsGateway {
  public constructor(
    private readonly notifications: PigeonNotificationsApi,
    private readonly invalidateSettings: (session: Session) => void,
  ) {}

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.notifications.list(session);
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.notifications.listSettings(session);
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    const saved = await this.notifications.saveSetting(session, setting);

    this.invalidateSettings(session);

    return saved;
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.notifications.resetSetting(session, scope);
    this.invalidateSettings(session);
  }

  public async updateNotification(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource> {
    return await this.notifications.update(session, notificationId, decision);
  }
}
