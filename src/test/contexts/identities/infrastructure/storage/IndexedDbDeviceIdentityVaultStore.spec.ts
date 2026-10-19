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
    firstKeychainPublishPending: true,
    identityId,
    secretHandle: 'secret-1',
    updatedAt: 1,
    version: 2,
    ...overrides,
  };
}

describe(IndexedDbDeviceIdentityVaultStore.name, () => {
  it('clears the first-publish marker and keeps the rest of the record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));

    await store.completeFirstKeychainPublish(identityId);

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-1',
      firstKeychainPublishPending: false,
      version: 2,
    });
  });

  it('keeps a marker cleared by a publish when a password change writes a stale copy', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const expected = recordFor(identityId.valueOf());
    await store.save(expected);
    await store.completeFirstKeychainPublish(identityId);

    await store.replaceProtection(
      expected,
      recordFor(identityId.valueOf(), { envelope: 'envelope-2' }),
    );

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-2',
      firstKeychainPublishPending: false,
    });
  });

  it('ignores a completion for an identity that has no vault record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());

    await expect(
      store.completeFirstKeychainPublish(identityId),
    ).resolves.toBeUndefined();
    await expect(store.find(identityId)).resolves.toBeUndefined();
  });
});
