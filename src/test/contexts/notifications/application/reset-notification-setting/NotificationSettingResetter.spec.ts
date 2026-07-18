import { mock } from 'jest-mock-extended';

import type { NotificationSettingRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationSettingRepository';

import { ResetNotificationSettingMessage } from '../../../../../contexts/notifications/application/reset-notification-setting/messages/ResetNotificationSettingMessage';
import { NotificationSettingResetter } from '../../../../../contexts/notifications/application/reset-notification-setting/NotificationSettingResetter';

describe(NotificationSettingResetter.name, () => {
  it('resets the scoped aggregate through the repository', async () => {
    const repository = mock<NotificationSettingRepository>();
    const resetter = new NotificationSettingResetter(repository);

    await resetter.reset(
      new ResetNotificationSettingMessage(
        'identity-1',
        'community',
        'community-1',
        undefined,
        42,
      ),
    );

    const [setting] = repository.reset.mock.calls[0] ?? [];

    expect(setting?.toPrimitives().scope).toEqual({
      communityId: 'community-1',
      type: 'community',
    });
    expect(setting?.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'NotificationSettingReset' }),
    ]);
  });
});
