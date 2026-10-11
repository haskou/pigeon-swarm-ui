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

  public handle(method: string, body?: string): unknown {
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

    await expect(
      api.loadOptional(session, { expected: false }),
    ).resolves.toBeUndefined();
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
          (_path: string, init: { body?: string; method: string }) =>
            server.handle(init.method, init.body),
        ),
      } as unknown as HttpJsonClient,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      new KeychainCipher(),
      { invalidateForSession: jest.fn() } as unknown as RequestCache,
    );

    await Promise.all([
      api.publishKeychain(session, (current) => ({
        ...current,
        conversations: {
          ...current.conversations,
          'conversation-a': {
            conversationId: 'conversation-a',
          } as ConversationKeyEntry,
        },
      })),
      api.publishKeychain(session, (current) => ({
        ...current,
        conversations: {
          ...current.conversations,
          'conversation-b': {
            conversationId: 'conversation-b',
          } as ConversationKeyEntry,
        },
      })),
    ]);

    expect(server.headConversationIds()).toEqual([
      'conversation-a',
      'conversation-b',
    ]);
  });

  describe('loadOptional replication lag', () => {
    const keychainResource = {
      encryptedPayload: 'encrypted',
      keychainExternalIdentifier: 'kc-1',
    } as KeychainResource;

    const lagError = (): HttpJsonError =>
      new HttpJsonError(
        409,
        'Conflict',
        JSON.stringify({ code: 'KeychainNotFoundError' }),
      );

    function apiFor(request: jest.Mock): PigeonKeychainApi {
      return new PigeonKeychainApi(
        { request } as unknown as HttpJsonClient,
        {
          headers: jest.fn().mockResolvedValue({}),
        } as unknown as RequestSigner,
        {} as KeychainCipher,
        {
          keyForSession: () => 'cache-key',
          load: async (_key: string, loader: () => Promise<KeychainResource>) =>
            await loader(),
        } as unknown as RequestCache,
      );
    }

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns the keychain once it replicates after transient 409s', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(lagError())
        .mockRejectedValueOnce(lagError())
        .mockResolvedValueOnce(keychainResource);
      const pending = apiFor(request).loadOptional(session, { expected: true });

      await jest.runAllTimersAsync();

      await expect(pending).resolves.toBe(keychainResource);
      expect(request).toHaveBeenCalledTimes(3);
    });

    it('reports no keychain after a bounded retry window when the 409 persists', async () => {
      const request = jest.fn().mockRejectedValue(lagError());
      const startedAt = Date.now();
      const pending = apiFor(request).loadOptional(session, { expected: true });

      await jest.runAllTimersAsync();

      await expect(pending).resolves.toBeUndefined();
      expect(Date.now() - startedAt).toBeLessThanOrEqual(10_000);
      expect(request).toHaveBeenCalledTimes(7);
    });

    it('reads once when no keychain is expected so first registration is not delayed', async () => {
      const request = jest.fn().mockRejectedValue(lagError());
      const startedAt = Date.now();

      await expect(
        apiFor(request).loadOptional(session, { expected: false }),
      ).resolves.toBeUndefined();

      expect(Date.now() - startedAt).toBe(0);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('stops retrying when aborted and rejects rather than reporting no keychain', async () => {
      const reason = new Error('load cancelled');
      const request = jest.fn().mockRejectedValue(lagError());
      const controller = new AbortController();
      const pending = apiFor(request).loadOptional(session, {
        expected: true,
        signal: controller.signal,
      });
      const outcome = expect(pending).rejects.toBe(reason);

      await jest.advanceTimersByTimeAsync(100);
      controller.abort(reason);
      await outcome;

      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry other failures', async () => {
      const failure = new HttpJsonError(
        500,
        'Internal Server Error',
        JSON.stringify({ code: 'InternalError' }),
      );
      const request = jest.fn().mockRejectedValue(failure);

      await expect(
        apiFor(request).loadOptional(session, { expected: true }),
      ).rejects.toBe(failure);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });
});
