import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';
import type { SaveNotificationSettingPort } from '../ports/SaveNotificationSettingPort';

import { SaveNotificationSettingMessage } from './messages/SaveNotificationSettingMessage';

export class SaveNotificationSetting {
  public constructor(
    private readonly notificationSettings: SaveNotificationSettingPort,
  ) {}

  public async save(
    message: SaveNotificationSettingMessage,
  ): Promise<NotificationScopeSetting> {
    return await this.notificationSettings.saveNotificationSetting(
      message.getSession(),
      message.getSetting(),
    );
  }
}
