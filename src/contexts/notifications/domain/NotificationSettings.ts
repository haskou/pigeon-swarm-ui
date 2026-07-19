import type { NotificationSettingScope } from './value-objects/NotificationSettingScope';

import { NotificationSetting } from './NotificationSetting';

export class NotificationSettings {
  public static from(settings: NotificationSetting[]): NotificationSettings {
    return new NotificationSettings(settings);
  }

  private constructor(private readonly settings: NotificationSetting[]) {}

  public resolve(scope: NotificationSettingScope): NotificationSetting {
    const exact = this.settings.find((setting) => setting.belongsTo(scope));

    if (exact) return exact;

    const parent = scope.communityParent();
    const inherited = parent
      ? this.settings.find((setting) => setting.belongsTo(parent))
      : undefined;

    return inherited ?? NotificationSetting.defaults(scope);
  }
}
