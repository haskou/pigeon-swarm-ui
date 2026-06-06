import type { ResetNotificationSettingPort } from '../ports/ResetNotificationSettingPort';

import { ResetNotificationSettingMessage } from './messages/ResetNotificationSettingMessage';

export class ResetNotificationSetting {
  public constructor(
    private readonly notificationSettings: ResetNotificationSettingPort,
  ) {}

  public async reset(message: ResetNotificationSettingMessage): Promise<void> {
    await this.notificationSettings.resetNotificationSetting(
      message.getSession(),
      message.getScope(),
    );
  }
}
