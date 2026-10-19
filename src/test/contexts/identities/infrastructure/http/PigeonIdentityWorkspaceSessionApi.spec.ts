import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { LoginIdentityProgressReporter } from '../../../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { IdentityWorkspaceSource } from '../../../../../contexts/identities/infrastructure/http/IdentityWorkspaceSource';
import type { KeychainResource } from '../../../../../contexts/identities/infrastructure/http/resources/KeychainResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { KeychainHeadUnavailableError } from '../../../../../contexts/identities/infrastructure/http/errors/KeychainHeadUnavailableError';
import { PigeonIdentityWorkspaceSessionApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

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

  describe('when the node has not finished opening its replicated state', () => {
    const notReady = new HttpJsonError(
      503,
      'Service Unavailable',
      JSON.stringify({ code: 503020 }),
    );

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('retries the conversation list until the node answers', async () => {
      const workspace = port();
      workspace.listConversations
        .mockRejectedValueOnce(notReady)
        .mockRejectedValueOnce(notReady)
        .mockResolvedValue(conversations);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      const pending = api.hydrate(session);
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(pending).resolves.toMatchObject({ conversations });
      expect(workspace.listConversations).toHaveBeenCalledTimes(3);
    });

    it('rejects instead of returning an empty list once retries are exhausted', async () => {
      const workspace = port();
      workspace.listConversations.mockRejectedValue(notReady);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      const pending = api.hydrate(session).catch((caught: unknown) => caught);
      await jest.advanceTimersByTimeAsync(16_000);

      await expect(pending).resolves.toBe(notReady);
      expect(workspace.listConversations).toHaveBeenCalledTimes(9);
    });

    it('rejects a refresh once retries are exhausted', async () => {
      const workspace = port();
      workspace.listConversations.mockRejectedValue(notReady);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      const pending = api.refresh(session).catch((caught: unknown) => caught);
      await jest.advanceTimersByTimeAsync(16_000);

      await expect(pending).resolves.toBe(notReady);
    });

    it('reports that the node is starting while sign-in waits on the conversation list', async () => {
      const workspace = port();
      workspace.listConversations
        .mockRejectedValueOnce(notReady)
        .mockResolvedValue(conversations);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);
      const onProgress = jest.fn();

      const pending = api.hydrate(session, onProgress);
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(pending).resolves.toMatchObject({ conversations });
      expect(onProgress).toHaveBeenCalledWith('node-starting');
    });

    it('keeps the node-starting notice up until the conversation list finishes retrying', async () => {
      const workspace = port();
      workspace.loadKeychain.mockImplementation(
        () =>
          new Promise<KeychainResource | undefined>((resolve) => {
            setTimeout(() => resolve(keychainResource), 500);
          }),
      );
      workspace.listConversations
        .mockRejectedValueOnce(notReady)
        .mockRejectedValueOnce(notReady)
        .mockResolvedValue(conversations);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);
      const onProgress = jest.fn();

      const pending = api.hydrate(session, onProgress);
      // The keychain lands at 500ms while the list still waits for its third attempt at 750ms.
      await jest.advanceTimersByTimeAsync(600);

      expect(onProgress).toHaveBeenLastCalledWith('node-starting');

      await jest.advanceTimersByTimeAsync(1_000);
      await expect(pending).resolves.toMatchObject({ conversations });
    });

    it('does not retry failures other than 503020', async () => {
      const failure = new HttpJsonError(
        500,
        'Internal Server Error',
        JSON.stringify({ code: 'Error' }),
      );
      const workspace = port();
      workspace.listConversations.mockRejectedValue(failure);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.hydrate(session)).rejects.toBe(failure);
      expect(workspace.listConversations).toHaveBeenCalledTimes(1);
    });

    it('rejects sign-in without a session when the keychain read stays 503020', async () => {
      const workspace = port();
      workspace.loadKeychain.mockRejectedValue(notReady);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.hydrate(session)).rejects.toBe(notReady);
      expect(workspace.decryptKeychain).not.toHaveBeenCalled();
    });
  });

  describe('when the session holds a keychain pointer', () => {
    const pointed = {
      ...session,
      keychainExternalIdentifier: 'keychain-cid',
    } as Session;

    it('fails sign-in instead of an empty keychain when the pointed keychain stays unread', async () => {
      const workspace = port();
      workspace.loadKeychain.mockResolvedValue(undefined);
      const api = new PigeonIdentityWorkspaceSessionApi(workspace);

      await expect(api.hydrate(pointed)).rejects.toBeInstanceOf(
        KeychainHeadUnavailableError,
      );
      expect(workspace.decryptKeychain).not.toHaveBeenCalled();
    });
  });
});
