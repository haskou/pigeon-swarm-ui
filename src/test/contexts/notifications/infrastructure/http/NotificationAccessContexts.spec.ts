import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { NotificationRecipientId } from '../../../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { NotificationAccessContextNotFoundError } from '../../../../../contexts/notifications/infrastructure/http/errors/NotificationAccessContextNotFoundError';
import { NotificationAccessContexts } from '../../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';

describe(NotificationAccessContexts.name, () => {
  it('finds a registered recipient session', () => {
    const contexts = new NotificationAccessContexts();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;

    contexts.register(session);

    expect(
      contexts.find(NotificationRecipientId.fromString('identity-1')),
    ).toBe(session);
  });

  it('rejects recipients without a registered session', () => {
    expect(() =>
      new NotificationAccessContexts().find(
        NotificationRecipientId.fromString('identity-1'),
      ),
    ).toThrow(NotificationAccessContextNotFoundError);
  });
});
