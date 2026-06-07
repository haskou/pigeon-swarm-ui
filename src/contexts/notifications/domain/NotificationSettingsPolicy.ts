import type {
  NotificationMentionContext,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingMap,
  NotificationSettingScope,
} from './notificationSettings.types';

export class NotificationSettingsPolicy {
  public static readonly defaults: NotificationScopeSetting = {
    hideMutedChannels: false,
    mobilePushEnabled: true,
    notificationLevel: 'all',
    scope: { conversationId: '__defaults__', type: 'conversation' },
    suppressEveryoneAndHere: false,
    suppressRoleMentions: false,
  };

  private static isMentioned(
    setting: NotificationScopeSetting,
    context: NotificationMentionContext,
  ): boolean {
    if (context.mentionedIdentityIds?.includes(context.currentIdentityId)) {
      return true;
    }

    if (!setting.suppressEveryoneAndHere && context.mentionsEveryoneOrHere) {
      return true;
    }

    if (setting.suppressRoleMentions) return false;

    if (context.mentionedRoleMemberIds?.includes(context.currentIdentityId)) {
      return true;
    }

    const currentRoleIds = context.currentRoleIds ?? [];

    return currentRoleIds.some((roleId) =>
      context.mentionedRoleIds?.includes(roleId),
    );
  }

  public static key(scope: NotificationSettingScope): string {
    if (scope.type === 'conversation') {
      return `conversation:${scope.conversationId}`;
    }

    if (scope.type === 'community') {
      return `community:${scope.communityId}`;
    }

    return `community_channel:${scope.communityId}:${scope.channelId}`;
  }

  public static map(
    settings: NotificationScopeSetting[],
  ): NotificationSettingMap {
    return Object.fromEntries(
      settings.map((setting) => [
        NotificationSettingsPolicy.key(setting.scope),
        NotificationSettingsPolicy.normalize(setting),
      ]),
    );
  }

  public static normalize(
    setting: NotificationScopeSettingInput,
  ): NotificationScopeSetting {
    return {
      ...NotificationSettingsPolicy.defaults,
      ...setting,
      scope: setting.scope,
    };
  }

  public static resolve(
    settings: NotificationSettingMap,
    scope: NotificationSettingScope,
  ): NotificationScopeSetting {
    const exact = settings[NotificationSettingsPolicy.key(scope)];

    if (exact) return NotificationSettingsPolicy.normalize(exact);

    if (scope.type === 'community_channel') {
      const communitySetting =
        settings[
          NotificationSettingsPolicy.key({
            communityId: scope.communityId,
            type: 'community',
          })
        ];

      if (communitySetting) {
        return NotificationSettingsPolicy.normalize(communitySetting);
      }
    }

    return {
      ...NotificationSettingsPolicy.defaults,
      scope,
    };
  }

  public static isMuted(
    setting: NotificationScopeSetting,
    now: number = Date.now(),
  ): boolean {
    if (setting.notificationLevel === 'none') return true;

    if (setting.mutedUntil === null) return true;

    return typeof setting.mutedUntil === 'number' && setting.mutedUntil > now;
  }

  public static shouldHide(
    setting: NotificationScopeSetting,
    now: number = Date.now(),
  ): boolean {
    return (
      setting.hideMutedChannels &&
      NotificationSettingsPolicy.isMuted(setting, now)
    );
  }

  public static shouldNotify(
    setting: NotificationScopeSetting,
    context: NotificationMentionContext,
    now: number = Date.now(),
  ): boolean {
    if (NotificationSettingsPolicy.isMuted(setting, now)) return false;

    if (setting.notificationLevel === 'all') return true;

    if (setting.notificationLevel === 'none') return false;

    return NotificationSettingsPolicy.isMentioned(setting, context);
  }
}
