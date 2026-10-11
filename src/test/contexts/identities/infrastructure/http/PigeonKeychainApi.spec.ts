import type {
  ConversationKeyEntry,
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { KeychainCipher } from '../../../../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

type StoredKeychain = {
  encryptedPayload: string;
  externalId: string;
  previousKeychainExternalIdentifier: string | null;
  version: number;
};

// Mirrors the node publish rules: a candidate needs an existing previous
// keychain at version - 1 (or no keychain yet for version 1). Forks are
// accepted. The head is the highest-version stored keychain.
class FakeKeychainServer {
  private readonly stored: StoredKeychain[] = [];

  public seed(keychain: LocalKeychain, externalId: string): void {
    this.stored.push({
      encryptedPayload: JSON.stringify(keychain),
      externalId,
      previousKeychainExternalIdentifier: null,
      version: keychain.version,
    });
  }

  public headConversationIds(): string[] {
    const head = this.stored.reduce<StoredKeychain | undefined>(
      (best, keychain) =>
        !best || keychain.version >= best.version ? keychain : best,
      undefined,
    );

    if (!head) {
      return [];
    }

    const keychain = JSON.parse(head.encryptedPayload) as LocalKeychain;

    return Object.keys(keychain.conversations).sort();
  }

  public async handle(method: string, body?: string): Promise<unknown> {
    if (method === 'GET') {
      const head = this.stored.reduce<StoredKeychain | undefined>(
        (best, keychain) =>
          !best || keychain.version >= best.version ? keychain : best,
        undefined,
      );

      if (!head) {
        throw new HttpJsonError(
          404,
          'Not Found',
          JSON.stringify({ code: 'KeychainNotFoundError' }),
        );
      }

      return {
        encryptedPayload: head.encryptedPayload,
        keychainExternalIdentifier: head.externalId,
        ownerIdentityId: 'identity-1',
        previousKeychainExternalIdentifier:
          head.previousKeychainExternalIdentifier,
        signature: 'signature',
        timestamp: 1,
        version: head.version,
      };
    }

    const candidate = JSON.parse(body ?? '{}') as {
      encryptedPayload: string;
      previousKeychainExternalIdentifier: string | null;
      version: number;
    };
    const previous = this.stored.find(
      (keychain) =>
        keychain.externalId === candidate.previousKeychainExternalIdentifier,
    );
    const accepted = previous
      ? candidate.version === previous.version + 1
      : this.stored.length === 0 && candidate.version === 1;

    if (!accepted) {
      throw new HttpJsonError(
        409,
        'Conflict',
        JSON.stringify({ code: 'InvalidKeychainCandidateError' }),
      );
    }

    const externalId = `kc-${this.stored.length + 1}`;

    this.stored.push({
      encryptedPayload: candidate.encryptedPayload,
      externalId,
      previousKeychainExternalIdentifier:
        candidate.previousKeychainExternalIdentifier,
      version: candidate.version,
    });

    return {
      keychainExternalIdentifier: externalId,
      ownerIdentityId: 'identity-1',
      version: candidate.version,
    };
  }
}

describe(PigeonKeychainApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('loads a signed remote keychain through the request cache', async () => {
    const resource = { encryptedPayload: 'encrypted' } as KeychainResource;
    const request = jest.fn().mockResolvedValue(resource);
    const headers = jest.fn().mockResolvedValue({});
    const load = jest
      .fn<
        Promise<KeychainResource>,
        [string, () => Promise<KeychainResource>, { ttlMs?: number }]
      >()
      .mockImplementation(async (_key, loader) => await loader());
    const api = new PigeonKeychainApi(
      { request } as unknown as HttpJsonClient,
      { headers } as unknown as RequestSigner,
      {} as KeychainCipher,
      {
        keyForSession: jest.fn().mockReturnValue('cache-key'),
        load,
      } as unknown as RequestCache,
    );

    await expect(api.load(session)).resolves.toBe(resource);
    expect(request).toHaveBeenCalledWith('/keychains/identity-1', {
      headers: {},
      method: 'GET',
    });
    expect(load).toHaveBeenCalledWith('cache-key', expect.any(Function), {
      ttlMs: 1500,
    });
  });

  it('decrypts through the keychain cipher', () => {
    const keychain = { conversations: {}, version: 1 } as LocalKeychain;
    const decrypt = jest.fn().mockReturnValue(keychain);
    const api = new PigeonKeychainApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      { decrypt } as unknown as KeychainCipher,
      {} as RequestCache,
    );
    const resource = { encryptedPayload: 'encrypted' } as KeychainResource;

    expect(api.decrypt(session, resource)).toBe(keychain);
    expect(decrypt).toHaveBeenCalledWith(session, resource);
  });

  it('returns an empty result when the remote keychain does not exist', async () => {
    const load = jest
      .fn<
        Promise<KeychainResource>,
        [string, () => Promise<KeychainResource>, { ttlMs?: number }]
      >()
      .mockImplementation(async (_key, loader) => await loader());
    const api = new PigeonKeychainApi(
      {
        request: jest
          .fn()
          .mockRejectedValue(
            new HttpJsonError(
              404,
              'Not Found',
              JSON.stringify({ code: 'KeychainNotFoundError' }),
            ),
          ),
      } as unknown as HttpJsonClient,
      { headers: jest.fn() } as unknown as RequestSigner,
      {} as KeychainCipher,
      {
        keyForSession: jest.fn().mockReturnValue('cache-key'),
        load,
      } as unknown as RequestCache,
    );

    await expect(api.loadOptional(session)).resolves.toBeUndefined();
  });

  it('keeps both conversation keys when two publishes start from one stale snapshot', async () => {
    const server = new FakeKeychainServer();
    const keychain: LocalKeychain = {
      conversations: {},
      timestamp: 1,
      version: 1,
    };
    server.seed(keychain, 'kc-1');
    const session = {
      identity: { id: 'identity-1' },
      keychain,
      keychainExternalIdentifier: 'kc-1',
      keyPair: {
        sign: jest.fn().mockReturnValue({ toString: () => 'signature' }),
      },
      masterKey: {
        decrypt: (payload: { valueOf(): string }) => ({
          toString: () => payload.valueOf(),
        }),
        encrypt: (plaintext: string) => ({ toString: () => plaintext }),
      },
      password: 'secret',
    } as unknown as Session;
    const api = new PigeonKeychainApi(
      {
        request: jest.fn(
          async (_path: string, init: { body?: string; method: string }) =>
            await server.handle(init.method, init.body),
        ),
      } as unknown as HttpJsonClient,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      new KeychainCipher(),
      { invalidateForSession: jest.fn() } as unknown as RequestCache,
    );

    await Promise.all([
      api.publishKeychain(session, {
        ...session.keychain,
        conversations: {
          ...session.keychain.conversations,
          'conversation-a': {
            conversationId: 'conversation-a',
          } as ConversationKeyEntry,
        },
      }),
      api.publishKeychain(session, {
        ...session.keychain,
        conversations: {
          ...session.keychain.conversations,
          'conversation-b': {
            conversationId: 'conversation-b',
          } as ConversationKeyEntry,
        },
      }),
    ]);

    expect(server.headConversationIds()).toEqual([
      'conversation-a',
      'conversation-b',
    ]);
  });
});
