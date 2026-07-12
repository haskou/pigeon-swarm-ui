import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { AcceptConversationInvitation } from '../../../../../contexts/notifications/application/accept-conversation-invitation/AcceptConversationInvitation';
import { AcceptConversationInvitationMessage } from '../../../../../contexts/notifications/application/accept-conversation-invitation/messages/AcceptConversationInvitationMessage';

describe(AcceptConversationInvitation.name, () => {
  it('decrypts, publishes and accepts an invitation', async () => {
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;
    const notification = {
      id: 'notification-1',
      payload: { encryptedConversationKey: 'encrypted-key' },
      state: 'pending',
      type: 'conversation_invitation',
    } as NotificationResource;
    const keyEntry = {
      conversationId: 'conversation-1',
      kind: 'conversation',
    } as LocalKeychain['conversations'][string];
    const published = {
      keychain: { conversations: { 'conversation-1': keyEntry }, version: 2 },
      keychainExternalIdentifier: 'keychain-2',
    };
    const expected = {
      ...published,
      notification: { ...notification, state: 'accepted' },
    };
    const keyDecryptor = {
      decryptInvitationKey: jest.fn().mockResolvedValue(keyEntry),
    };
    const keychainPublisher = {
      publishKeychain: jest.fn().mockResolvedValue(published),
    };
    const notifications = {
      updateNotification: jest.fn().mockResolvedValue(expected.notification),
    };
    const useCase = new AcceptConversationInvitation(
      keyDecryptor,
      keychainPublisher,
      notifications,
    );

    await expect(
      useCase.accept(
        new AcceptConversationInvitationMessage({ notification, session }),
      ),
    ).resolves.toEqual(expected);
    expect(keyDecryptor.decryptInvitationKey).toHaveBeenCalledWith(
      session,
      'encrypted-key',
    );
    expect(keychainPublisher.publishKeychain).toHaveBeenCalledWith(
      session,
      published.keychain,
    );
    expect(notifications.updateNotification).toHaveBeenCalled();
  });
});
