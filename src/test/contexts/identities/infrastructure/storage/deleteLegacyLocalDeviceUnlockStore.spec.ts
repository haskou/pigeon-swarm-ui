import 'fake-indexeddb/auto';

import { deleteLegacyLocalDeviceUnlockStore } from '../../../../../contexts/identities/infrastructure/storage/deleteLegacyLocalDeviceUnlockStore';

const legacyDatabaseName = 'pigeon-swarm-device-unlock';

function createLegacyDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(legacyDatabaseName, 1);

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

async function legacyDatabaseExists(): Promise<boolean> {
  const databases = await indexedDB.databases();

  return databases.some((database) => database.name === legacyDatabaseName);
}

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(legacyDatabaseName);

    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => resolve());
  });
});

describe(deleteLegacyLocalDeviceUnlockStore.name, () => {
  it('removes the database that held master key material in the removed design', async () => {
    await createLegacyDatabase();
    expect(await legacyDatabaseExists()).toBe(true);

    await deleteLegacyLocalDeviceUnlockStore();

    expect(await legacyDatabaseExists()).toBe(false);
  });

  it('does not create the database when none exists', async () => {
    await deleteLegacyLocalDeviceUnlockStore();

    expect(await legacyDatabaseExists()).toBe(false);
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

  it('removes the database when indexedDB.databases() is unavailable', async () => {
    await createLegacyDatabase();
    const databases = indexedDB.databases;

    Object.defineProperty(indexedDB, 'databases', {
      configurable: true,
      value: undefined,
    });

    try {
      await deleteLegacyLocalDeviceUnlockStore();
    } finally {
      Object.defineProperty(indexedDB, 'databases', {
        configurable: true,
        value: databases,
      });
    }

    expect(await legacyDatabaseExists()).toBe(false);
  });
});
