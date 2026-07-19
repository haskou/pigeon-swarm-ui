import type { NotificationSetting } from '../../domain/NotificationSetting';
import type { NotificationSettingRepository } from '../../domain/repositories/NotificationSettingRepository';

import { SearchNotificationSettingsMessage } from './messages/SearchNotificationSettingsMessage';

export class NotificationSettingsSearcher {
  public constructor(
    private readonly repository: NotificationSettingRepository,
  ) {}

  public async search(
    message: SearchNotificationSettingsMessage,
  ): Promise<NotificationSetting[]> {
    return await this.repository.searchByRecipient(
      message.getRecipientIdentityId(),
    );
  }
}
