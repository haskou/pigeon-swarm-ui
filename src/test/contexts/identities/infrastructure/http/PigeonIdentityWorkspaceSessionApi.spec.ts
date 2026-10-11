import type { LoginIdentityProgressReporter } from '../../../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { IdentityWorkspaceSource } from '../../../../../contexts/identities/infrastructure/http/IdentityWorkspaceSource';
import type {
  ConversationResource,
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonIdentityWorkspaceSessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';

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

  it('hydrates keychain and conversations while reporting workspace progress', async () => {
    const workspace = port();
    const progress = jest.fn() as unknown as LoginIdentityProgressReporter;
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);

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
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);

    await expect(api.refresh(session)).resolves.toMatchObject({
      conversations,
      session: { keychain: { version: 3 } },
    });

    expect(workspace.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ keychain: { conversations: {}, version: 3 } }),
    );
  });

  describe('when the session already holds conversation keys', () => {
    const populatedKeychain = {
      conversations: { 'conversation-1': { key: 'kept' } },
      version: 3,
    } as unknown as LocalKeychain;
    const populatedSession = {
      identity: { id: 'identity-1' },
      keychain: populatedKeychain,
      keychainExternalIdentifier: 'keychain-cid',
    } as unknown as Session;

    it('keeps the session keychain when the refresh read finds nothing', async () => {
      const workspace = port();
      workspace.loadKeychain.mockResolvedValue(undefined);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.refresh(populatedSession)).resolves.toMatchObject({
        session: {
          keychain: populatedKeychain,
          keychainExternalIdentifier: 'keychain-cid',
        },
      });
      expect(workspace.decryptKeychain).not.toHaveBeenCalled();
    });

    it('keeps the session keychain when a stale read is older than it', async () => {
      const workspace = port();
      workspace.decryptKeychain.mockReturnValue({
        conversations: {},
        version: 2,
      });
      workspace.loadKeychain.mockResolvedValue({
        encryptedPayload: 'stale-keychain',
        keychainExternalIdentifier: 'stale-cid',
      } as KeychainResource);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.refresh(populatedSession)).resolves.toMatchObject({
        session: {
          keychain: populatedKeychain,
          keychainExternalIdentifier: 'keychain-cid',
        },
      });
    });

    it('applies a newer keychain read', async () => {
      const workspace = port();
      workspace.decryptKeychain.mockReturnValue({
        conversations: {},
        version: 4,
      });
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.refresh(populatedSession)).resolves.toMatchObject({
        session: {
          keychain: { version: 4 },
          keychainExternalIdentifier: 'keychain-cid',
        },
      });
    });
  });

  it('hydrates an absent keychain as empty for a new or fresh login', async () => {
    const workspace = port();
    workspace.loadKeychain.mockResolvedValue(undefined);
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);

    await expect(api.hydrate(session)).resolves.toMatchObject({
      session: {
        keychain: { conversations: {}, version: 0 },
        keychainExternalIdentifier: null,
      },
    });
  });

  it('expects a keychain when hydrating an existing identity login', async () => {
    const workspace = port();
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);

    await api.hydrate(session);

    expect(workspace.loadKeychain).toHaveBeenCalledWith(session, {
      expected: true,
    });
  });

  it('reads a keychain once when hydrating a newly registered identity', async () => {
    const workspace = port();
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);

    await api.hydrate(session, undefined, { keychainExpected: false });

    expect(workspace.loadKeychain).toHaveBeenCalledWith(session, {
      expected: false,
    });
  });

  it('expects a keychain on refresh only when the session already references one', async () => {
    const workspace = port();
    const api = new PigeonIdentityWorkspaceSessionApi(workspace);
    const withKeychain = {
      ...session,
      keychainExternalIdentifier: 'keychain-cid',
    };

    await api.refresh(session);
    expect(workspace.loadKeychain).toHaveBeenLastCalledWith(session, {
      expected: false,
    });

    await api.refresh(withKeychain);
    expect(workspace.loadKeychain).toHaveBeenLastCalledWith(withKeychain, {
      expected: true,
    });
  });
});
