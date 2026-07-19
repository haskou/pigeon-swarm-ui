import { mock } from 'jest-mock-extended';

import type { NotificationSettingRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationSettingRepository';

import { ConfigureNotificationSettingMessage } from '../../../../../contexts/notifications/application/configure-notification-setting/messages/ConfigureNotificationSettingMessage';
import { NotificationSettingConfigurer } from '../../../../../contexts/notifications/application/configure-notification-setting/NotificationSettingConfigurer';

describe(NotificationSettingConfigurer.name, () => {
  it('creates and persists a setting through its aggregate root', async () => {
    const repository = mock<NotificationSettingRepository>();
    repository.save.mockImplementation((setting) => Promise.resolve(setting));
    const configurer = new NotificationSettingConfigurer(repository);

    const setting = await configurer.configure(
      new ConfigureNotificationSettingMessage({
        firstScopeIdentifier: 'community-1',
        hideMutedChannels: true,
        mobilePushEnabled: true,
        mutedUntil: null,
        notificationLevel: 'mentions',
        occurredAt: 42,
        recipientIdentityId: 'identity-1',
        scopeType: 'community_channel',
        secondScopeIdentifier: 'channel-1',
        suppressEveryoneAndHere: true,
        suppressRoleMentions: false,
      }),
    );

    expect(setting.toPrimitives()).toEqual(
      expect.objectContaining({
        hideMutedChannels: true,
        mutedUntil: null,
        notificationLevel: 'mentions',
        scope: {
          channelId: 'channel-1',
          communityId: 'community-1',
          type: 'community_channel',
        },
      }),
    );
    expect(setting.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'NotificationSettingSaved' }),
    ]);
    expect(repository.save).toHaveBeenCalled();
  });
});
