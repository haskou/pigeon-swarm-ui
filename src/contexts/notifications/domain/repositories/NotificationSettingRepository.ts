import type { NotificationSetting } from '../NotificationSetting';
import type { NotificationRecipientId } from '../value-objects/NotificationRecipientId';

export interface NotificationSettingRepository {
  reset(
    setting: NotificationSetting,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void>;
  save(
    setting: NotificationSetting,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<NotificationSetting>;
  searchByRecipient(
    recipientIdentityId: NotificationRecipientId,
  ): Promise<NotificationSetting[]>;
}
