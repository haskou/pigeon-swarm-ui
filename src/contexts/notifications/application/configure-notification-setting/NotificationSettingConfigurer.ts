import type { NotificationSetting } from '../../domain/NotificationSetting';
import type { NotificationSettingRepository } from '../../domain/repositories/NotificationSettingRepository';

import { NotificationSetting as NotificationSettingAggregate } from '../../domain/NotificationSetting';
import { ConfigureNotificationSettingMessage } from './messages/ConfigureNotificationSettingMessage';

export class NotificationSettingConfigurer {
  public constructor(
    private readonly repository: NotificationSettingRepository,
  ) {}

  public async configure(
    message: ConfigureNotificationSettingMessage,
  ): Promise<NotificationSetting> {
    const setting = NotificationSettingAggregate.configure(
      message.getScope(),
      message.getLevel(),
      message.getMute(),
      message.getPreferences(),
      message.getOccurredAt(),
    );

    return await this.repository.save(
      setting,
      message.getRecipientIdentityId(),
    );
  }
}
