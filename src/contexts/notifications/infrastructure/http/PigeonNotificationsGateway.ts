import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NotificationResource } from './resources/NotificationResource';
import type { NotificationScopeSettingInputResource } from './resources/NotificationScopeSettingInputResource';
import type { NotificationScopeSettingResource } from './resources/NotificationScopeSettingResource';
import type { NotificationSettingScopeResource } from './resources/NotificationSettingScopeResource';

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
  ): Promise<NotificationScopeSettingResource[]> {
    return await this.notifications.listSettings(session);
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInputResource,
  ): Promise<NotificationScopeSettingResource> {
    const saved = await this.notifications.saveSetting(session, setting);

    this.invalidateSettings(session);

    return saved;
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScopeResource,
  ): Promise<void> {
    await this.notifications.resetSetting(session, scope);
    this.invalidateSettings(session);
  }

  public async updateNotification(
    session: Session,
    notificationId: string,
    state: string,
  ): Promise<NotificationResource> {
    return await this.notifications.update(session, notificationId, state);
  }
}
