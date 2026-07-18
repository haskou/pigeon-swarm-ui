import { mock } from 'jest-mock-extended';

import type { NotificationSettingRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationSettingRepository';

import { SearchNotificationSettingsMessage } from '../../../../../contexts/notifications/application/search-notification-settings/messages/SearchNotificationSettingsMessage';
import { NotificationSettingsSearcher } from '../../../../../contexts/notifications/application/search-notification-settings/NotificationSettingsSearcher';

describe(NotificationSettingsSearcher.name, () => {
  it('searches settings by recipient identity', async () => {
    const repository = mock<NotificationSettingRepository>();
    repository.searchByRecipient.mockResolvedValue([]);
    const searcher = new NotificationSettingsSearcher(repository);

    await expect(
      searcher.search(new SearchNotificationSettingsMessage('identity-1')),
    ).resolves.toEqual([]);
    expect(repository.searchByRecipient).toHaveBeenCalled();
  });
});
