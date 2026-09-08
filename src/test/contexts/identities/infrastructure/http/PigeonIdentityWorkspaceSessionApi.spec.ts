import { createHash } from 'crypto';

import type { LoginIdentityProgressReporter } from '../../../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { IdentityWorkspaceSource } from '../../../../../contexts/identities/infrastructure/http/IdentityWorkspaceSource';
import type { ConversationKeyEntry } from '../../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type {
  ConversationResource,
  KeychainResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { ConversationKeychainRecovery } from '../../../../../app/composition/identities/ConversationKeychainRecovery';
import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { PigeonIdentityWorkspaceSessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';
import { ConversationKeychain } from '../../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';

describe(PigeonIdentityWorkspaceSessionApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 0 },
  } as unknown as Session;
  const keychainResource = {
    encryptedPayload: 'encrypted-keychain',
    keychainExternalIdentifier: 'keychain-cid',
  } as KeychainResource;
  const conversations = [
    { id: 'conversation-1' },
  ] as unknown as ConversationResource[];

  function port(): jest.Mocked<IdentityWorkspaceSource> {
    return {
      decryptKeychain: jest.fn().mockReturnValue({
        conversations: {},
        version: 3,
      }),
      listConversations: jest.fn().mockResolvedValue(conversations),
      loadKeychain: jest.fn().mockResolvedValue(keychainResource),
    };
  }

  it.each(['hydrate', 'refresh'] as const)(
    'restores a persisted key stored under the legacy participant order during %s',
    async (operation) => {
      const workspace = port();
      const current = {
        ...session,
        identity: { ...session.identity, id: 'identity-a' },
      };
      const canonicalId = `one-to-one:${createHash('sha256').update('identity-B:identity-a:network-1').digest('hex')}`;
      const legacyId = `one-to-one:${createHash('sha256').update('identity-a:identity-B:network-1').digest('hex')}`;
      const entry: ConversationKeyEntry = {
        algorithm: 'aes-256-gcm',
        conversationId: legacyId,
        createdAt: 1,
        key: 'existing-encrypted-conversation-key',
        kind: 'conversation',
        peerIdentityId: 'identity-B',
        version: 2,
      };
      workspace.decryptKeychain.mockReturnValue({
        conversations: { [legacyId]: entry },
        version: 3,
      });
      workspace.listConversations.mockResolvedValue([
        {
          id: canonicalId,
          networkId: 'network-1',
          peerIdentityId: 'identity-B',
          type: 'one-to-one',
        },
      ]);
      const api = new PigeonIdentityWorkspaceSessionApi(
        workspace,
        new ConversationKeychainRecovery(new ConversationIdFactory()),
      );

      const result = await api[operation](current);

      expect(
        ConversationKeychain.entry(
          result.session.keychain,
          current.identity.id,
          canonicalId,
        ),
      ).toEqual({ ...entry, conversationId: canonicalId });
      expect(result.session.keychain.conversations[legacyId]).toEqual(entry);
      expect(result.session.keychain.version).toBe(3);
      expect(result.session.keychainExternalIdentifier).toBe('keychain-cid');
    },
  );

  it('hydrates keychain and conversations while reporting workspace progress', async () => {
    const workspace = port();
    const progress = jest.fn() as unknown as LoginIdentityProgressReporter;
    const api = new PigeonIdentityWorkspaceSessionApi(
      workspace,
      new ConversationKeychainRecovery(new ConversationIdFactory()),
    );

    await expect(api.hydrate(session, progress)).resolves.toMatchObject({
      conversations,
      session: {
        keychain: { version: 3 },
        keychainExternalIdentifier: 'keychain-cid',
      },
    });

    expect(progress).toHaveBeenNthCalledWith(1, 'loading-keychain');
    expect(progress).toHaveBeenNthCalledWith(2, 'loading-workspace');
    expect(workspace.listConversations).toHaveBeenCalledWith(session);
    expect(workspace.decryptKeychain).toHaveBeenCalledWith(
      session,
      keychainResource,
    );
  });

  it('refreshes the keychain before loading conversations', async () => {
    const workspace = port();
    const api = new PigeonIdentityWorkspaceSessionApi(
      workspace,
      new ConversationKeychainRecovery(new ConversationIdFactory()),
    );

    await expect(api.refresh(session)).resolves.toMatchObject({
      conversations,
      session: { keychain: { version: 3 } },
    });

    expect(workspace.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ keychain: { conversations: {}, version: 3 } }),
    );
  });
});
