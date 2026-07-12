import type { IdentityWorkspaceSessionPort } from '../../../../../contexts/identities/application/ports/IdentityWorkspaceSessionPort';
import type { LoginIdentityProgressReporter } from '../../../../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type {
  ConversationResource,
  KeychainResource,
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

  function port(): jest.Mocked<IdentityWorkspaceSessionPort> {
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
});
