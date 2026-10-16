import {
  EncryptedPayload,
  KeyPair,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/keychain-signature.json';

import type { KeychainResource } from '../../../../../contexts/identities/infrastructure/http/resources/KeychainResource';
import type { ConversationKeyEntry } from '../../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { KeychainCipher } from '../../../../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const owner = KeyPair.fromPrimitives({
  privateKey: vectors.keys.owner.privateKeyPem,
  publicKey: vectors.keys.owner.publicKeyPem,
} as never);
const ownerIdentity = { id: vectors.keys.owner.publicKeyPem };

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
    this.seedSealed(JSON.stringify(keychain), externalId, keychain.version);
  }

  public seedSealed(
    encryptedPayload: string,
    externalId: string,
    version: number,
  ): void {
    this.stored.push({
      encryptedPayload,
      externalId,
      previousKeychainExternalIdentifier: null,
      version,
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
      deviceSealedRootKey: {
        decrypt: (payload: { valueOf(): string }) => ({
          toString: () => payload.valueOf(),
        }),
        encrypt: (plaintext: string) => ({ toString: () => plaintext }),
      },
      identity: ownerIdentity,
      keychain,
      keychainExternalIdentifier: 'kc-1',
      keyPair: owner,
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
    const pointedSession = {
      identity: { id: 'identity-1' },
      keychainExternalIdentifier: 'kc-1',
    } as unknown as Session;
    const signingSession = {
      deviceSealedRootKey: {
        decrypt: (payload: { valueOf(): string }) => ({
          toString: () => payload.valueOf(),
        }),
        encrypt: (plaintext: string) => ({ toString: () => plaintext }),
      },
      identity: ownerIdentity,
      keyPair: owner,
      password: 'secret',
    };
    const emptyKeychain: LocalKeychain = {
      conversations: {},
      timestamp: 1,
      version: 0,
    };

    const lagError = (): HttpJsonError =>
      new HttpJsonError(
        409,
        'Conflict',
        JSON.stringify({ code: 'KeychainNotFoundError' }),
      );

    function apiFor(
      request: jest.Mock,
      cipher: KeychainCipher = {} as KeychainCipher,
    ): PigeonKeychainApi {
      return new PigeonKeychainApi(
        { request } as unknown as HttpJsonClient,
        {
          headers: jest.fn().mockResolvedValue({}),
        } as unknown as RequestSigner,
        cipher,
        {
          invalidateForSession: jest.fn(),
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
      const pending = apiFor(request).loadOptional(pointedSession);

      await jest.runAllTimersAsync();

      await expect(pending).resolves.toBe(keychainResource);
      expect(request).toHaveBeenCalledTimes(3);
    });

    it('reports no keychain after the bounded retry window when the 409 persists', async () => {
      const request = jest.fn().mockRejectedValue(lagError());
      const pending = apiFor(request).loadOptional(pointedSession);

      await jest.runAllTimersAsync();

      await expect(pending).resolves.toBeUndefined();
      expect(request).toHaveBeenCalledTimes(7);
    });

    it('reads once when the session holds no keychain pointer so login and registration are not delayed', async () => {
      const request = jest.fn().mockRejectedValue(lagError());
      const startedAt = Date.now();

      await expect(
        apiFor(request).loadOptional(session),
      ).resolves.toBeUndefined();

      expect(Date.now() - startedAt).toBe(0);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('stops retrying once the caller aborts the load', async () => {
      const controller = new AbortController();
      const request = jest.fn().mockRejectedValue(lagError());
      const pending = apiFor(request).loadOptional(pointedSession, {
        signal: controller.signal,
      });

      await jest.advanceTimersByTimeAsync(300);
      controller.abort(new Error('aborted'));

      await expect(pending).rejects.toThrow('aborted');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not retry failures other than a missing keychain', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new HttpJsonError(500, 'Server Error', '{}'));
      const pending = apiFor(request).loadOptional(pointedSession);

      await expect(pending).rejects.toThrow(HttpJsonError);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('retries a lagging head read before publishing when the session already holds a keychain', async () => {
      const seeded: LocalKeychain = {
        conversations: {
          'conversation-seed': {
            conversationId: 'conversation-seed',
          } as ConversationKeyEntry,
        },
        timestamp: 1,
        version: 1,
      };
      const server = new FakeKeychainServer();
      server.seed(seeded, 'kc-1');
      let laggingReads = 2;
      const request = jest.fn(
        (_path: string, init: { body?: string; method: string }) => {
          if (init.method === 'GET' && laggingReads > 0) {
            laggingReads -= 1;
            throw lagError();
          }

          return server.handle(init.method, init.body);
        },
      );
      const session = {
        ...signingSession,
        keychain: seeded,
        keychainExternalIdentifier: 'kc-1',
      } as unknown as Session;
      const outcome = expect(
        apiFor(request, new KeychainCipher()).publishKeychain(
          session,
          (current) => ({
            ...current,
            conversations: {
              ...current.conversations,
              'conversation-a': {
                conversationId: 'conversation-a',
              } as ConversationKeyEntry,
            },
          }),
        ),
      ).resolves.toMatchObject({ keychainExternalIdentifier: 'kc-2' });

      await jest.runAllTimersAsync();

      await outcome;
      expect(server.headConversationIds()).toEqual([
        'conversation-a',
        'conversation-seed',
      ]);
    });

    it('publishes without waiting when the session holds no keychain yet', async () => {
      const server = new FakeKeychainServer();
      const request = jest.fn(
        (_path: string, init: { body?: string; method: string }) =>
          server.handle(init.method, init.body),
      );
      const session = {
        ...signingSession,
        keychain: emptyKeychain,
        keychainExternalIdentifier: null,
      } as unknown as Session;
      const startedAt = Date.now();

      await expect(
        apiFor(request, new KeychainCipher()).publishKeychain(
          session,
          (current) => ({
            ...current,
            conversations: {
              ...current.conversations,
              'conversation-a': {
                conversationId: 'conversation-a',
              } as ConversationKeyEntry,
            },
          }),
        ),
      ).resolves.toMatchObject({ keychainExternalIdentifier: 'kc-1' });

      expect(Date.now() - startedAt).toBe(0);
      expect(request).toHaveBeenCalledTimes(2);
      expect(server.headConversationIds()).toEqual(['conversation-a']);
    });
  });

  describe('device-sealed root head', () => {
    const masterKey = SymmetricKey.generate();
    const rootKey = SymmetricKey.generate();
    const otherKey = SymmetricKey.generate();
    const keychain: LocalKeychain = {
      conversations: {
        'conversation-a': {
          conversationId: 'conversation-a',
        } as ConversationKeyEntry,
      },
      timestamp: 1,
      version: 1,
    };
    const sealedUnder = (key: SymmetricKey): string =>
      key.encrypt(JSON.stringify(keychain)).toString();
    const sessionWith = (extra: Record<string, unknown> = {}): Session =>
      ({
        identity: ownerIdentity,
        keyPair: owner,
        masterKey,
        ...extra,
      }) as unknown as Session;
    const apiOver = (server: FakeKeychainServer): PigeonKeychainApi =>
      new PigeonKeychainApi(
        {
          request: jest.fn(
            (_path: string, init: { body?: string; method: string }) =>
              server.handle(init.method, init.body),
          ),
        } as unknown as HttpJsonClient,
        {
          headers: jest.fn().mockResolvedValue({}),
        } as unknown as RequestSigner,
        new KeychainCipher(),
        {
          invalidateForSession: jest.fn(),
          keyForSession: () => 'cache-key',
          load: async (_key: string, loader: () => Promise<KeychainResource>) =>
            await loader(),
        } as unknown as RequestCache,
      );

    it('reads the head under the session root', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(rootKey), 'kc-1', 1);

      await expect(
        apiOver(server).readHead(sessionWith({ deviceSealedRootKey: rootKey })),
      ).resolves.toMatchObject({
        keychain: { conversations: keychain.conversations, version: 1 },
        keychainExternalIdentifier: 'kc-1',
      });
    });

    it('returns no head when the identity has no keychain yet', async () => {
      await expect(
        apiOver(new FakeKeychainServer()).readHead(
          sessionWith({ deviceSealedRootKey: rootKey }),
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects a masterKey-sealed head while a root is held', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(masterKey), 'kc-1', 1);

      await expect(
        apiOver(server).readHead(sessionWith({ deviceSealedRootKey: rootKey })),
      ).rejects.toThrow();
    });

    it('rejects a masterKey-sealed head when no root is held', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(masterKey), 'kc-1', 1);

      await expect(apiOver(server).readHead(sessionWith())).rejects.toThrow();
    });

    it('rejects a head sealed under neither the root nor masterKey', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(otherKey), 'kc-1', 1);

      await expect(
        apiOver(server).readHead(sessionWith({ deviceSealedRootKey: rootKey })),
      ).rejects.toThrow();
    });

    it('does not fall back to masterKey when no root is held', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(rootKey), 'kc-1', 1);

      await expect(apiOver(server).readHead(sessionWith())).rejects.toThrow();
    });

    it('rewraps the head under the session root, chained to the head it replaces', async () => {
      const server = new FakeKeychainServer();
      server.seedSealed(sealedUnder(rootKey), 'kc-1', 1);

      await apiOver(server).rewrapHead(
        sessionWith({ deviceSealedRootKey: rootKey }),
        { keychain, keychainExternalIdentifier: 'kc-1' },
      );

      const stored = server.handle('GET') as KeychainResource;

      expect(stored).toMatchObject({
        keychainExternalIdentifier: 'kc-2',
        previousKeychainExternalIdentifier: 'kc-1',
        version: 2,
      });
      expect(() =>
        rootKey.decrypt(new EncryptedPayload(stored.encryptedPayload)),
      ).not.toThrow();
    });

    describe('rewrapHeadSealedUnder', () => {
      const nextRoot = SymmetricKey.generate();

      it('reseals a head sealed under the previous root with the session root, chained to the head it replaces', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(rootKey), 'kc-1', 1);

        await apiOver(server).rewrapHeadSealedUnder(
          sessionWith({ deviceSealedRootKey: nextRoot }),
          rootKey,
        );

        const stored = server.handle('GET') as KeychainResource;

        expect(stored).toMatchObject({
          keychainExternalIdentifier: 'kc-2',
          previousKeychainExternalIdentifier: 'kc-1',
          version: 2,
        });
        expect(() =>
          nextRoot.decrypt(new EncryptedPayload(stored.encryptedPayload)),
        ).not.toThrow();
      });

      it('leaves a head already sealed under the session root alone', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(nextRoot), 'kc-1', 1);

        await apiOver(server).rewrapHeadSealedUnder(
          sessionWith({ deviceSealedRootKey: nextRoot }),
          rootKey,
        );

        expect(server.handle('GET')).toMatchObject({
          keychainExternalIdentifier: 'kc-1',
          version: 1,
        });
      });

      it('rejects a head sealed under neither the previous root nor the session root', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(otherKey), 'kc-1', 1);

        await expect(
          apiOver(server).rewrapHeadSealedUnder(
            sessionWith({ deviceSealedRootKey: nextRoot }),
            rootKey,
          ),
        ).rejects.toThrow();
        expect(server.handle('GET')).toMatchObject({
          keychainExternalIdentifier: 'kc-1',
          version: 1,
        });
      });

      it('rejects a head sealed under the master key rather than the previous root', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(masterKey), 'kc-1', 1);

        await expect(
          apiOver(server).rewrapHeadSealedUnder(
            sessionWith({ deviceSealedRootKey: nextRoot }),
            rootKey,
          ),
        ).rejects.toThrow();
        expect(server.handle('GET')).toMatchObject({
          keychainExternalIdentifier: 'kc-1',
          version: 1,
        });
      });
    });

    describe('replaceHeadAfterRecovery', () => {
      it('replaces a head no root opens with an empty keychain under the session root, chained to the head it replaces', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(otherKey), 'kc-1', 1);

        await apiOver(server).replaceHeadAfterRecovery(
          sessionWith({ deviceSealedRootKey: rootKey }),
        );

        const stored = server.handle('GET') as KeychainResource;

        expect(stored).toMatchObject({
          keychainExternalIdentifier: 'kc-2',
          previousKeychainExternalIdentifier: 'kc-1',
          version: 2,
        });
        expect(
          JSON.parse(
            rootKey
              .decrypt(new EncryptedPayload(stored.encryptedPayload))
              .toString(),
          ),
        ).toMatchObject({ conversations: {}, version: 2 });
      });

      it('leaves a head already sealed under the session root alone', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(rootKey), 'kc-1', 1);

        await apiOver(server).replaceHeadAfterRecovery(
          sessionWith({ deviceSealedRootKey: rootKey }),
        );

        expect(server.handle('GET')).toMatchObject({
          keychainExternalIdentifier: 'kc-1',
          version: 1,
        });
      });

      it('publishes nothing when the identity has no keychain yet', async () => {
        const server = new FakeKeychainServer();

        await apiOver(server).replaceHeadAfterRecovery(
          sessionWith({ deviceSealedRootKey: rootKey }),
        );

        expect(() => server.handle('GET')).toThrow(HttpJsonError);
      });

      it('publishes nothing without a root', async () => {
        const server = new FakeKeychainServer();
        server.seedSealed(sealedUnder(otherKey), 'kc-1', 1);

        await expect(
          apiOver(server).replaceHeadAfterRecovery(sessionWith()),
        ).rejects.toThrow();
        expect(server.handle('GET')).toMatchObject({
          keychainExternalIdentifier: 'kc-1',
          version: 1,
        });
      });
    });
  });
});
