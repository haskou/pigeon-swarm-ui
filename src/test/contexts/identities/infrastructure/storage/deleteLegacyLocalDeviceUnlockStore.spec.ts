import 'fake-indexeddb/auto';

import { deleteLegacyLocalDeviceUnlockStore } from '../../../../../contexts/identities/infrastructure/storage/deleteLegacyLocalDeviceUnlockStore';

const legacyDatabaseName = 'pigeon-swarm-device-unlock';
const scopeA = 'a'.repeat(64);
const scopeB = 'b'.repeat(64);
const scopedLegacyA = `${legacyDatabaseName}:${scopeA}`;
const scopedLegacyB = `${legacyDatabaseName}:${scopeB}`;
const vaultDatabaseName = 'pigeon-swarm-device-vault';

function createDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);

    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore('sessions', { keyPath: 'identityId' });
    });
    request.addEventListener('success', () => {
      request.result.close();
      resolve();
    });
    request.addEventListener('error', () => reject(request.error));
  });
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);

    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => resolve());
  });
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((database) => database.name ?? '');
}

function replaceIndexedDbMethod<T>(
  method: 'databases' | 'open',
  value: unknown,
  run: () => Promise<T>,
): Promise<T> {
  const original = indexedDB[method];

  Object.defineProperty(indexedDB, method, { configurable: true, value });

  return run().finally(() => {
    Object.defineProperty(indexedDB, method, {
      configurable: true,
      value: original,
    });
  });
}

afterEach(async () => {
  for (const name of await databaseNames()) await deleteDatabase(name);
});

describe(deleteLegacyLocalDeviceUnlockStore.name, () => {
  it('removes the unscoped database that held master key material in the removed design', async () => {
    await createDatabase(legacyDatabaseName);

    await deleteLegacyLocalDeviceUnlockStore();

    expect(await databaseNames()).not.toContain(legacyDatabaseName);
  });

  it('removes every per-node scoped legacy database of the independent client', async () => {
    await createDatabase(scopedLegacyA);
    await createDatabase(scopedLegacyB);

    await deleteLegacyLocalDeviceUnlockStore();

    expect(await databaseNames()).toEqual([]);
  });

  it('keeps the device vault and unrelated databases', async () => {
    await createDatabase(legacyDatabaseName);
    await createDatabase(vaultDatabaseName);
    await createDatabase(`${vaultDatabaseName}:${scopeA}`);
    await createDatabase(`${legacyDatabaseName}-other`);

    await deleteLegacyLocalDeviceUnlockStore();

    expect((await databaseNames()).sort()).toEqual(
      [
        vaultDatabaseName,
        `${vaultDatabaseName}:${scopeA}`,
        `${legacyDatabaseName}-other`,
      ].sort(),
    );
  });

  it('does not create the database when none exists', async () => {
    await deleteLegacyLocalDeviceUnlockStore();

    expect(await databaseNames()).toEqual([]);
  });

  it('never opens a legacy database', async () => {
    await createDatabase(legacyDatabaseName);
    await createDatabase(scopedLegacyA);
    const open = jest.fn();

    await replaceIndexedDbMethod('open', open, () =>
      deleteLegacyLocalDeviceUnlockStore(),
    );

    expect(open).not.toHaveBeenCalled();
  });

  it('removes the unscoped database when indexedDB.databases() is unavailable', async () => {
    await createDatabase(legacyDatabaseName);

    await replaceIndexedDbMethod('databases', undefined, () =>
      deleteLegacyLocalDeviceUnlockStore(),
    );

    expect(await databaseNames()).not.toContain(legacyDatabaseName);
  });

  it('resolves when indexedDB.databases() rejects', async () => {
    await createDatabase(legacyDatabaseName);
    await expect(
      replaceIndexedDbMethod(
        'databases',
        () => Promise.reject(new Error('unsupported')),
        () => deleteLegacyLocalDeviceUnlockStore(),
      ),
    ).resolves.toBeUndefined();

    expect(await databaseNames()).not.toContain(legacyDatabaseName);
  });

  it('resolves when IndexedDB is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(
        deleteLegacyLocalDeviceUnlockStore(),
      ).resolves.toBeUndefined();
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'indexedDB', descriptor);
    }
  });
});
