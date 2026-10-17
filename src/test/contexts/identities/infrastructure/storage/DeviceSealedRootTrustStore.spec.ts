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

  it('keys the fingerprint with a subkey derived from the vault root key, never with that key itself', () => {
    const { entries, storage } = memoryStorage();
    const root = SymmetricKey.generate();
    const subkey = hkdf(
      sha256,
      vaultRootKey.getBuffer(),
      undefined,
      utf8ToBytes('pigeon-swarm/device-sealed-root-trust/v2'),
      32,
    );
    const message = concatBytes(
      utf8ToBytes('pigeon-swarm/device-sealed-root-trust'),
      utf8ToBytes(':identity-1:4:'),
      root.getBuffer(),
    );

    new DeviceSealedRootTrustStore(storage).remember(
      'identity-1',
      vaultRootKey,
      root,
      4,
    );

    const [kept] = [...entries.values()];

    expect(kept).toBe(`4.${encodeBase64Url(hmac(sha256, subkey, message))}`);
    expect(kept).not.toContain(
      encodeBase64Url(hmac(sha256, vaultRootKey.getBuffer(), message)),
    );
  });

  it('trusts nothing from a record it cannot parse, such as one written before the subkey', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', vaultRootKey, root, 4);

    const [key, kept] = [...entries.entries()][0];

    entries.set(key, kept.split('.')[1]);

    expect(store.trusts('identity-1', vaultRootKey, root)).toBe(false);
    expect(
      store.supersedes('identity-1', vaultRootKey, SymmetricKey.generate(), 4),
    ).toBe(false);
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
