import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

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
  const localKey = SymmetricKey.generate();

  it('trusts only the root it last remembered for the identity', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const first = SymmetricKey.generate();
    const second = SymmetricKey.generate();

    store.remember('identity-1', localKey, first);
    store.remember('identity-1', localKey, second);

    expect(store.trusts('identity-1', localKey, second)).toBe(true);
    expect(store.trusts('identity-1', localKey, first)).toBe(false);
    expect(store.trusts('identity-2', localKey, second)).toBe(false);
  });

  it('trusts nothing under another local key, so a planted record opens nothing', () => {
    const store = new DeviceSealedRootTrustStore(memoryStorage().storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', SymmetricKey.generate(), root);

    expect(store.trusts('identity-1', localKey, root)).toBe(false);
  });

  it('keeps a keyed fingerprint, never the root', () => {
    const { entries, storage } = memoryStorage();
    const root = SymmetricKey.generate();

    new DeviceSealedRootTrustStore(storage).remember(
      'identity-1',
      localKey,
      root,
    );

    const kept = [...entries.values()].join();

    expect(entries.size).toBe(1);
    expect(kept).not.toContain(encodeBase64Url(root.getBuffer()));
    expect(kept).not.toContain(root.getBuffer().toString('base64'));
  });

  it('trusts nothing once forgotten', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRootTrustStore(storage);
    const root = SymmetricKey.generate();

    store.remember('identity-1', localKey, root);
    store.forget('identity-1');

    expect(store.trusts('identity-1', localKey, root)).toBe(false);
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

    expect(store.trusts('identity-1', localKey, SymmetricKey.generate())).toBe(
      false,
    );
  });
});
