import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { DeviceIdentityVaultRecord } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultRecord';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IndexedDbDeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/IndexedDbDeviceIdentityVaultStore';

function recordFor(
  identityId: string,
  overrides: Partial<DeviceIdentityVaultRecord> = {},
): DeviceIdentityVaultRecord {
  return {
    authorizationEpoch: 'epoch-1',
    authorizationRevision: 1,
    createdAt: 1,
    deviceId: 'device-1',
    encryptedMaterial: 'encrypted-material',
    envelope: 'envelope-1',
    factorKey: {} as CryptoKey,
    firstKeychainPublish: 'armed',
    identityId,
    secretHandle: 'secret-1',
    updatedAt: 1,
    version: 2,
    ...overrides,
  };
}

describe(IndexedDbDeviceIdentityVaultStore.name, () => {
  it('sets the first-publish marker and keeps the rest of the record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));

    await store.setFirstKeychainPublish(identityId, 'none');

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-1',
      firstKeychainPublish: 'none',
      version: 2,
    });
  });

  it('keeps a marker set by a publish when a password change writes a stale copy', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const expected = recordFor(identityId.valueOf());
    await store.save(expected);
    await store.setFirstKeychainPublish(identityId, 'none');

    await store.replaceProtection(
      expected,
      recordFor(identityId.valueOf(), { envelope: 'envelope-2' }),
    );

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-2',
      firstKeychainPublish: 'none',
    });
  });

  it('keeps an ambiguous marker through a protection replace', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const expected = recordFor(identityId.valueOf());
    await store.save(expected);
    await store.setFirstKeychainPublish(identityId, 'ambiguous');

    await store.replaceProtection(
      expected,
      recordFor(identityId.valueOf(), { envelope: 'envelope-2' }),
    );

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-2',
      firstKeychainPublish: 'ambiguous',
    });
  });

  it('inserts a new record with its marker', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());

    await store.insert(recordFor(identityId.valueOf()));

    await expect(store.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'armed',
    });
  });

  it('refuses to insert over an existing record and leaves its marker alone', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(
      recordFor(identityId.valueOf(), { firstKeychainPublish: 'none' }),
    );

    await expect(
      store.insert(recordFor(identityId.valueOf())),
    ).rejects.toThrow();

    await expect(store.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'none',
    });
  });

  it('ignores a marker write for an identity that has no vault record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());

    await expect(
      store.setFirstKeychainPublish(identityId, 'none'),
    ).resolves.toBeUndefined();
    await expect(store.find(identityId)).resolves.toBeUndefined();
  });

  it('keeps the marker when a save omits it', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));
    await store.setFirstKeychainPublish(identityId, 'ambiguous');

    const unmarked = recordFor(identityId.valueOf(), {
      envelope: 'envelope-2',
    });
    delete unmarked.firstKeychainPublish;
    await store.save(unmarked);

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-2',
      firstKeychainPublish: 'ambiguous',
    });
  });
});
