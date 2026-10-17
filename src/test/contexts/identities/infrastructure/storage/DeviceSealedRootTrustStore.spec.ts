import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { DeviceSealedRootTrustStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceSealedRootTrustStore';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';

function memoryStorage(): {
  entries: Map<string, string>;
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
} {
  const entries = new Map<string, string>();

  return {
    entries,
    storage: {
      getItem: (key) => entries.get(key) ?? null,
      removeItem: (key) => {
        entries.delete(key);
      },
      setItem: (key, value) => {
        entries.set(key, value);
      },
    },
  };
}

describe(DeviceSealedRootTrustStore.name, () => {
  const vaultRootKey = SymmetricKey.generate();

  it('trusts only the root it last remembered for the identity', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const first = SymmetricKey.generate();
    const second = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, first, 4);
    store.remember('identity-1', vaultRootKey, second, 4);

    expect(store.trusts('identity-1', vaultRootKey, second)).toBe(true);
    expect(store.trusts('identity-1', vaultRootKey, first)).toBe(false);
    expect(store.trusts('identity-2', vaultRootKey, second)).toBe(false);
  });

  it('trusts nothing under another vault root key, so a planted record opens nothing', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', SymmetricKey.generate(), root, 4);

    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(false);
  });

  it('keeps a keyed fingerprint, never the root', () => {
    const { entries, storage } = memoryStorage();
    const root = SymmetricKey.generate();

    new DeviceSealedRootTrustStore(storage).remember(
      'identity-1',
      vaultRootKey,
      root,
      4,
    );

    const kept = [...entries.values()].join();

    expect(entries.size).toBe(1);
    expect(kept).not.toContain(encodeBase64Url(root.getBuffer()));
    expect(kept).not.toContain(root.getBuffer().toString('base64'));
  });

  it('keys the fingerprint and the revision tag with a subkey derived from the vault root key, never with that key itself', () => {
    const { entries, storage } = memoryStorage();
    const root = SymmetricKey.generate();
    const subkey = hkdf(
      sha256,
      vaultRootKey.getBuffer(),
      undefined,
      utf8ToBytes('pigeon-swarm/device-sealed-root-trust/v3'),
      32,
    );
    const fingerprint = concatBytes(
      utf8ToBytes('pigeon-swarm/device-sealed-root-trust'),
      utf8ToBytes(':identity-1:4:'),
      root.getBuffer(),
    );
    const revision = utf8ToBytes(
      'pigeon-swarm/device-sealed-root-trust/revision:identity-1:4',
    );

    new DeviceSealedRootTrustStore(storage).remember(
      'identity-1',
      vaultRootKey,
      root,
      4,
    );

    const [kept] = [...entries.values()];

    expect(kept).toBe(
      `4.${encodeBase64Url(hmac(sha256, subkey, revision))}.${encodeBase64Url(
        hmac(sha256, subkey, fingerprint),
      )}`,
    );
    expect(kept).not.toContain(
      encodeBase64Url(hmac(sha256, vaultRootKey.getBuffer(), fingerprint)),
    );
  });

  it('trusts nothing from a record it cannot parse, such as one written before the revision tag', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, root, 4);

    const [key, kept] = [...entries.entries()][0];
    const [revision, , fingerprint] = kept.split('.');

    entries.set(key, `${revision}.${fingerprint}`);

    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(false);
    expect(
      store.supersedes('identity-1', vaultRootKey, SymmetricKey.generate(), 4),
    ).toBe(false);
  });

  it('trusts and supersedes nothing from a revision it cannot authenticate, and never keeps that revision', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const root = SymmetricKey.generate();
    const other = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, root, 4);

    const [key, kept] = [...entries.entries()][0];

    entries.set(key, kept.replace(/^4\./, '99.'));

    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(false);
    expect(store.supersedes('identity-1', vaultRootKey, other, 50)).toBe(false);

    store.remember('identity-1', vaultRootKey, root, 4);

    expect(store.supersedes('identity-1', vaultRootKey, other, 5)).toBe(false);
  });

  it('keeps the whole record it holds at a higher revision, so a rolled-back entry neither lowers the revision nor replaces the root trusted there', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const trusted = SymmetricKey.generate();
    const rolledBack = SymmetricKey.generate();
    const other = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, trusted, 5);
    store.remember('identity-1', vaultRootKey, rolledBack, 4);

    expect(store.trusts('identity-1', vaultRootKey, trusted)).toBe(true);
    expect(store.trusts('identity-1', vaultRootKey, rolledBack)).toBe(false);
    expect(store.supersedes('identity-1', vaultRootKey, trusted, 5)).toBe(
      false,
    );
    expect(store.supersedes('identity-1', vaultRootKey, other, 5)).toBe(true);
    expect(store.supersedes('identity-1', vaultRootKey, other, 6)).toBe(false);
  });

  it('removes the records of earlier versions for the identity when it remembers or forgets', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const earlier = (identityId: string) => [
      `pigeon-swarm:device-sealed-root-trust:v1:${identityId}`,
      `pigeon-swarm:device-sealed-root-trust:v2:${identityId}`,
    ];

    for (const key of [...earlier('identity-1'), ...earlier('identity-2')]) {
      entries.set(key, 'kept');
    }

    store.remember('identity-1', vaultRootKey, SymmetricKey.generate(), 4);

    expect([...entries.keys()].sort()).toEqual(
      [
        ...earlier('identity-2'),
        'pigeon-swarm:device-sealed-root-trust:v3:identity-1',
      ].sort(),
    );

    store.forget('identity-2');

    expect([...entries.keys()]).toEqual([
      'pigeon-swarm:device-sealed-root-trust:v3:identity-1',
    ]);
  });

  it('remembers and forgets the record even when the browser refuses to remove an earlier one', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore({
      ...storage,
      removeItem: (key) => {
        if (!key.includes(':v3:')) throw new Error('blocked');
        storage.removeItem(key);
      },
    });
    const root = SymmetricKey.generate();

    expect(() =>
      store.remember('identity-1', vaultRootKey, root, 4),
    ).not.toThrow();
    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(true);
    expect(() => store.forget('identity-1')).not.toThrow();
    expect(entries.size).toBe(0);
  });

  it('reports a root taken at or below the revision of another trusted root as superseded', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const trusted = SymmetricKey.generate();
    const other = SymmetricKey.generate();

    expect(store.supersedes('identity-1', vaultRootKey, other, 4)).toBe(false);

    store.remember('identity-1', vaultRootKey, trusted, 4);

    expect(store.supersedes('identity-1', vaultRootKey, other, 4)).toBe(true);
    expect(store.supersedes('identity-1', vaultRootKey, other, 3)).toBe(true);
    expect(store.supersedes('identity-1', vaultRootKey, other, 5)).toBe(false);
    expect(store.supersedes('identity-1', vaultRootKey, trusted, 4)).toBe(
      false,
    );
    expect(store.supersedes('identity-2', vaultRootKey, other, 4)).toBe(false);
  });

  it('trusts nothing once forgotten', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, root, 4);
    store.forget('identity-1');

    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(false);
    expect(entries.size).toBe(0);
  });

  it('trusts nothing when the storage cannot be read', () => {
    const store = new DeviceSealedRootTrustStore({
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      setItem: () => undefined,
    });

    expect(
      store.trusts('identity-1', vaultRootKey, SymmetricKey.generate()),
    ).toBe(false);
    expect(
      store.supersedes('identity-1', vaultRootKey, SymmetricKey.generate(), 4),
    ).toBe(false);
  });
});
