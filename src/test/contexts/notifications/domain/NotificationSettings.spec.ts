import { NotificationSetting } from '../../../../contexts/notifications/domain/NotificationSetting';
import { NotificationSettings } from '../../../../contexts/notifications/domain/NotificationSettings';
import { NotificationSettingScope } from '../../../../contexts/notifications/domain/value-objects/NotificationSettingScope';

describe(NotificationSettings.name, () => {
  it('resolves a channel override before its community setting', () => {
    const communityScope = NotificationSettingScope.fromPrimitives({
      communityId: 'community-1',
      type: 'community',
    });
    const channelScope = NotificationSettingScope.fromPrimitives({
      channelId: 'channel-1',
      communityId: 'community-1',
      type: 'community_channel',
    });
    const settings = NotificationSettings.from([
      NotificationSetting.fromPrimitives({
        ...NotificationSetting.defaults(communityScope).toPrimitives(),
        notificationLevel: 'mentions',
      }),
      NotificationSetting.fromPrimitives({
        ...NotificationSetting.defaults(channelScope).toPrimitives(),
        notificationLevel: 'none',
      }),
    ]);

    expect(
      settings.resolve(channelScope).toPrimitives().notificationLevel,
    ).toBe('none');
  });

  it('inherits the community setting when a channel has no override', () => {
    const communityScope = NotificationSettingScope.fromPrimitives({
      communityId: 'community-1',
      type: 'community',
    });
    const channelScope = NotificationSettingScope.fromPrimitives({
      channelId: 'channel-1',
      communityId: 'community-1',
      type: 'community_channel',
    });
    const communitySetting = NotificationSetting.fromPrimitives({
      ...NotificationSetting.defaults(communityScope).toPrimitives(),
      notificationLevel: 'mentions',
    });

    expect(
      NotificationSettings.from([communitySetting])
        .resolve(channelScope)
        .toPrimitives().notificationLevel,
    ).toBe('mentions');
  });
});
