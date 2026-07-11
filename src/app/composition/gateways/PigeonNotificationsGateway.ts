import type { NotificationDecision } from '../../../contexts/notifications/domain/NotificationDecision';
import type { NotificationId } from '../../../contexts/notifications/domain/NotificationId';
import type {
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonNotificationsApi } from '../../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';

export class PigeonNotificationsGateway {
  public constructor(
    private readonly notifications: PigeonNotificationsApi,
    private readonly invalidateSettings: (session: Session) => void,
  ) {}

  public async list(session: Session): Promise<NotificationResource[]> {
    return await this.notifications.list(session);
  }

  public async listSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.notifications.listSettings(session);
  }

  public async saveSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    const saved = await this.notifications.saveSetting(session, setting);

    this.invalidateSettings(session);

    return saved;
  }

  public async resetSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.notifications.resetSetting(session, scope);
    this.invalidateSettings(session);
  }

  public async update(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource> {
    return await this.notifications.update(session, notificationId, decision);
  }
}
