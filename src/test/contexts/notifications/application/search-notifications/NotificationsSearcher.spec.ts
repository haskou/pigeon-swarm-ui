import { mock } from 'jest-mock-extended';

import type { NotificationRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationRepository';

import { SearchNotificationsMessage } from '../../../../../contexts/notifications/application/search-notifications/messages/SearchNotificationsMessage';
import { NotificationsSearcher } from '../../../../../contexts/notifications/application/search-notifications/NotificationsSearcher';

describe(NotificationsSearcher.name, () => {
  it('searches notifications by recipient identity', async () => {
    const repository = mock<NotificationRepository>();
    repository.searchByRecipient.mockResolvedValue([]);
    const searcher = new NotificationsSearcher(repository);

    await expect(
      searcher.search(new SearchNotificationsMessage('identity-1')),
    ).resolves.toEqual([]);
    expect(repository.searchByRecipient).toHaveBeenCalledWith(
      expect.objectContaining({ isEqual: expect.any(Function) }),
    );
  });
});
