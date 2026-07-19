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

  it('does not replace a newer keychain with a stale concurrent session', () => {
    const contexts = new NotificationAccessContexts();
    const recipientId = NotificationRecipientId.fromString('identity-1');
    const staleSession = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, timestamp: 100, version: 2 },
    } as unknown as Session;
    const updatedSession = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, timestamp: 200, version: 2 },
    } as unknown as Session;

    contexts.register(staleSession);
    contexts.replace(recipientId, updatedSession);
    contexts.register(staleSession);

    expect(contexts.find(recipientId)).toBe(updatedSession);
  });

  it('registers a session carrying a newer keychain revision', () => {
    const contexts = new NotificationAccessContexts();
    const recipientId = NotificationRecipientId.fromString('identity-1');
    const previousSession = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, timestamp: 100, version: 2 },
    } as unknown as Session;
    const updatedSession = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, timestamp: 200, version: 2 },
    } as unknown as Session;

    contexts.register(previousSession);
    contexts.register(updatedSession);

    expect(contexts.find(recipientId)).toBe(updatedSession);
  });
});
