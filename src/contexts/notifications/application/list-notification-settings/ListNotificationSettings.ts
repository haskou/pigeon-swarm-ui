import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';
import type { ListNotificationSettingsPort } from './ListNotificationSettingsPort';

import { ListNotificationSettingsMessage } from './messages/ListNotificationSettingsMessage';

export class ListNotificationSettings {
  public constructor(
    private readonly notificationSettings: ListNotificationSettingsPort,
  ) {}

  public async list(
    message: ListNotificationSettingsMessage,
  ): Promise<NotificationScopeSetting[]> {
    return await this.notificationSettings.listNotificationSettings(
      message.getSession(),
    );
  }
}
