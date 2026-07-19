import type { NotificationSetting } from '../../domain/NotificationSetting';
import type { NotificationSettingRepository } from '../../domain/repositories/NotificationSettingRepository';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { NotificationAccessContexts } from './NotificationAccessContexts';
import { NotificationSettingMapper } from './NotificationSettingMapper';
import { PigeonNotificationsGateway } from './PigeonNotificationsGateway';

// prettier-ignore
export class PigeonNotificationSettingRepository
  implements NotificationSettingRepository {
  public constructor(
    private readonly gateway: PigeonNotificationsGateway,
    private readonly contexts: NotificationAccessContexts,
    private readonly mapper: NotificationSettingMapper,
  ) {}

  public async reset(
    setting: NotificationSetting,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void> {
    await this.gateway.resetNotificationSetting(
      this.contexts.find(recipientIdentityId),
      setting.toPrimitives().scope,
    );
  }

  public async save(
    setting: NotificationSetting,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<NotificationSetting> {
    const saved = await this.gateway.saveNotificationSetting(
      this.contexts.find(recipientIdentityId),
      this.mapper.toResource(setting),
    );

    return this.mapper.fromResource(saved);
  }

  public async searchByRecipient(
    recipientIdentityId: NotificationRecipientId,
  ): Promise<NotificationSetting[]> {
    const resources = await this.gateway.listNotificationSettings(
      this.contexts.find(recipientIdentityId),
    );

    return resources.map((resource) => this.mapper.fromResource(resource));
  }
}
