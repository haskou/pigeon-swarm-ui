import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { PigeonConversationInvitationKeyDecryptor } from '../../../../../contexts/notifications/infrastructure/crypto/PigeonConversationInvitationKeyDecryptor';
import type {
  ConversationKeyEntry,
  LocalKeychain,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { EncryptedInvitationKey } from '../../../../../contexts/notifications/domain/value-objects/EncryptedInvitationKey';
import { NotificationRecipientId } from '../../../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { PigeonInvitationKeyRecipient } from '../../../../../contexts/notifications/infrastructure/crypto/PigeonInvitationKeyRecipient';
import { NotificationAccessContexts } from '../../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';

describe(PigeonInvitationKeyRecipient.name, () => {
  it('publishes the received key and refreshes the recipient context', async () => {
    const contexts = new NotificationAccessContexts();
    const keyDecryptor = mock<PigeonConversationInvitationKeyDecryptor>();
    const identities = mock<PigeonIdentitiesGateway>();
    const keychain = { conversations: {}, version: 2 } as LocalKeychain;
    const session = {
      identity: { id: 'identity-1' },
      keychain,
    } as unknown as Session;
    const keyEntry: ConversationKeyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'conversation-1',
      createdAt: 42,
      key: 'conversation-key',
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    };
    const publishedKeychain = {
      conversations: { 'conversation-1': keyEntry },
      version: 3,
    } as LocalKeychain;
    contexts.register(session);
    keyDecryptor.decryptInvitationKey.mockResolvedValue(keyEntry);
    identities.publishKeychain.mockResolvedValue({
      keychain: publishedKeychain,
      keychainExternalIdentifier: 'keychain-3',
    });
    const recipient = new PigeonInvitationKeyRecipient(
      contexts,
      keyDecryptor,
      identities,
    );
    const recipientIdentityId =
      NotificationRecipientId.fromString('identity-1');

    await recipient.receive(
      recipientIdentityId,
      EncryptedInvitationKey.fromString('encrypted-key'),
    );

    expect(keyDecryptor.decryptInvitationKey).toHaveBeenCalledWith(
      session,
      'encrypted-key',
    );
    expect(identities.publishKeychain).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        conversations: { 'conversation-1': keyEntry },
      }),
    );
    expect(contexts.find(recipientIdentityId)).toEqual(
      expect.objectContaining({
        keychain: publishedKeychain,
        keychainExternalIdentifier: 'keychain-3',
      }),
    );
  });
});
