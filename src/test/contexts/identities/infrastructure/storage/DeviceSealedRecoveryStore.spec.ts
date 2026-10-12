import { DeviceSealedRecoveryStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceSealedRecoveryStore';

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

describe(DeviceSealedRecoveryStore.name, () => {
  it('keeps each identity pending record apart', () => {
    const store = new DeviceSealedRecoveryStore(memoryStorage().storage);

    store.write('identity-1', { keychainRewrap: 'sealed-a' });
    store.write('identity-2', {
      rootReseal: { authorizationRevision: 2, rootKey: 'sealed-b' },
    });

    expect(store.read('identity-1')).toEqual({ keychainRewrap: 'sealed-a' });
    expect(store.read('identity-2')).toEqual({
      rootReseal: { authorizationRevision: 2, rootKey: 'sealed-b' },
    });
  });

  it('removes the entry once nothing is pending', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRecoveryStore(storage);

    store.write('identity-1', { keychainRewrap: 'sealed-a' });
    store.write('identity-1', {});

    expect(entries.size).toBe(0);
    expect(store.read('identity-1')).toEqual({});
  });

  it('reads a corrupt or malformed entry as nothing pending', () => {
    const { entries, storage } = memoryStorage();
    const store = new DeviceSealedRecoveryStore(storage);

    store.write('identity-1', { keychainRewrap: 'sealed-a' });
    for (const key of entries.keys()) {
      entries.set(key, '{not json');
    }
    expect(store.read('identity-1')).toEqual({});

    for (const key of entries.keys()) {
      entries.set(key, JSON.stringify({ rootReseal: { rootKey: 1 } }));
    }
    expect(store.read('identity-1')).toEqual({});
  });
});
