import type { NotificationSettingRepository } from '../../domain/repositories/NotificationSettingRepository';

import { NotificationSetting } from '../../domain/NotificationSetting';
import { ResetNotificationSettingMessage } from './messages/ResetNotificationSettingMessage';

export class NotificationSettingResetter {
  public constructor(
    private readonly repository: NotificationSettingRepository,
  ) {}

  public async reset(message: ResetNotificationSettingMessage): Promise<void> {
    const setting = NotificationSetting.defaults(message.getScope());

    setting.reset(message.getOccurredAt());
    await this.repository.reset(setting, message.getRecipientIdentityId());
  }
}
