import type { NotificationSetting } from '../../domain/NotificationSetting';
import type { NotificationScopeSettingResource } from './resources/NotificationScopeSettingResource';

import { NotificationSetting as NotificationSettingAggregate } from '../../domain/NotificationSetting';

export class NotificationSettingMapper {
  public fromResource(
    resource: NotificationScopeSettingResource,
  ): NotificationSetting {
    return NotificationSettingAggregate.fromPrimitives({
      ...resource,
      mutedUntil: resource.mutedUntil,
      updatedAt: resource.updatedAt,
    });
  }

  public toResource(
    setting: NotificationSetting,
  ): NotificationScopeSettingResource {
    return setting.toPrimitives();
  }
}
