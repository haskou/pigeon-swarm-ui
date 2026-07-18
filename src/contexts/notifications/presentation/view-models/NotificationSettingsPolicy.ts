import { Timestamp } from '@haskou/value-objects';

import type { NotificationScopeSettingInputResource } from '../../infrastructure/http/resources/NotificationScopeSettingInputResource';
import type { NotificationScopeSettingResource } from '../../infrastructure/http/resources/NotificationScopeSettingResource';
import type { NotificationSettingScopeResource } from '../../infrastructure/http/resources/NotificationSettingScopeResource';
import type { NotificationMentionContext } from './NotificationMentionContext';
import type { NotificationSettingMap } from './NotificationSettingMap';

import { NotificationSetting } from '../../domain/NotificationSetting';
import { NotificationSettings } from '../../domain/NotificationSettings';
import { NotificationMention } from '../../domain/value-objects/NotificationMention';
import { NotificationSettingScope } from '../../domain/value-objects/NotificationSettingScope';

export class NotificationSettingsPolicy {
  public static readonly defaults: NotificationScopeSettingResource = {
    hideMutedChannels: false,
    mobilePushEnabled: true,
    notificationLevel: 'all',
    scope: { conversationId: '__defaults__', type: 'conversation' },
    suppressEveryoneAndHere: false,
    suppressRoleMentions: false,
  };

  private static domainSetting(
    setting: NotificationScopeSettingInputResource,
  ): NotificationSetting {
    return NotificationSetting.fromPrimitives({
      ...NotificationSettingsPolicy.normalize(setting),
      mutedUntil: setting.mutedUntil,
      updatedAt: undefined,
    });
  }

  public static isMuted(
    setting: NotificationScopeSettingResource,
    now: number = Date.now(),
  ): boolean {
    return NotificationSettingsPolicy.domainSetting(setting).isMuted(
      new Timestamp(now),
    );
  }

  public static key(scope: NotificationSettingScopeResource): string {
    return NotificationSettingScope.fromPrimitives(scope).key();
  }

  public static map(
    settings: NotificationScopeSettingResource[],
  ): NotificationSettingMap {
    return Object.fromEntries(
      settings.map((setting) => [
        NotificationSettingsPolicy.key(setting.scope),
        NotificationSettingsPolicy.normalize(setting),
      ]),
    );
  }

  public static normalize(
    setting: NotificationScopeSettingInputResource,
  ): NotificationScopeSettingResource {
    return {
      ...NotificationSettingsPolicy.defaults,
      ...setting,
      scope: setting.scope,
    };
  }

  public static resolve(
    settings: NotificationSettingMap,
    scope: NotificationSettingScopeResource,
  ): NotificationScopeSettingResource {
    const domainSettings = NotificationSettings.from(
      Object.values(settings).map((setting) =>
        NotificationSettingsPolicy.domainSetting(setting),
      ),
    );
    const resolved = domainSettings.resolve(
      NotificationSettingScope.fromPrimitives(scope),
    );

    return {
      ...resolved.toPrimitives(),
      scope: resolved.belongsTo(NotificationSettingScope.fromPrimitives(scope))
        ? scope
        : resolved.toPrimitives().scope,
    };
  }

  public static shouldHide(
    setting: NotificationScopeSettingResource,
    now: number = Date.now(),
  ): boolean {
    return NotificationSettingsPolicy.domainSetting(setting).shouldHide(
      new Timestamp(now),
    );
  }

  public static shouldNotify(
    setting: NotificationScopeSettingResource,
    context: NotificationMentionContext,
    now: number = Date.now(),
  ): boolean {
    return NotificationSettingsPolicy.domainSetting(setting).shouldNotify(
      NotificationMention.fromPrimitives(context),
      new Timestamp(now),
    );
  }
}
