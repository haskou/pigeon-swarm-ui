import { mock } from 'jest-mock-extended';

import type { PwaNotificationCapability } from '../../../../../contexts/notifications/infrastructure/browser/PwaNotificationCapability';

import { PwaNotificationPresenter } from '../../../../../contexts/notifications/infrastructure/browser/PwaNotificationPresenter';

describe(PwaNotificationPresenter.name, () => {
  it('does not present notifications in unsupported environments', async () => {
    const capability = mock<PwaNotificationCapability>();
    capability.canNotify.mockReturnValue(false);
    const presenter = new PwaNotificationPresenter(capability);

    await presenter.show({ body: 'Body', tag: 'tag', title: 'Title' });

    expect(capability.canNotify).toHaveBeenCalled();
  });
});
