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
  it('clears the first-publish marker and keeps the rest of the record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));

    await store.clearFirstKeychainPublish(identityId);

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-1',
      firstKeychainPublish: 'none',
      version: 2,
    });
  });

  it('moves the marker when it still holds the expected state', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));

    await expect(
      store.transitionFirstKeychainPublish(identityId, 'armed', 'ambiguous'),
    ).resolves.toBe(true);

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-1',
      firstKeychainPublish: 'ambiguous',
    });
  });

  it('lets only one of two racing tabs move an armed marker to ambiguous', async () => {
    const firstTab = new IndexedDbDeviceIdentityVaultStore();
    const secondTab = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await firstTab.save(recordFor(identityId.valueOf()));

    const outcomes = await Promise.all([
      firstTab.transitionFirstKeychainPublish(identityId, 'armed', 'ambiguous'),
      secondTab.transitionFirstKeychainPublish(
        identityId,
        'armed',
        'ambiguous',
      ),
    ]);

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    await expect(firstTab.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'ambiguous',
    });
  });

  it('leaves a marker that no longer holds the expected state untouched', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(
      recordFor(identityId.valueOf(), { firstKeychainPublish: 'none' }),
    );

    await expect(
      store.transitionFirstKeychainPublish(identityId, 'ambiguous', 'armed'),
    ).resolves.toBe(false);

    await expect(store.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'none',
      updatedAt: 1,
    });
  });

  it('reads a record without a marker as none for a transition', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const unmarked = recordFor(identityId.valueOf());
    delete unmarked.firstKeychainPublish;
    await store.save(unmarked);

    await expect(
      store.transitionFirstKeychainPublish(identityId, 'armed', 'ambiguous'),
    ).resolves.toBe(false);

    await expect(store.find(identityId)).resolves.toEqual(unmarked);
  });

  it('keeps a marker set by a publish when a password change writes a stale copy', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const expected = recordFor(identityId.valueOf());
    await store.save(expected);
    await store.clearFirstKeychainPublish(identityId);

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
    await store.transitionFirstKeychainPublish(
      identityId,
      'armed',
      'ambiguous',
    );

    await store.replaceProtection(
      expected,
      recordFor(identityId.valueOf(), { envelope: 'envelope-2' }),
    );

    await expect(store.find(identityId)).resolves.toMatchObject({
      envelope: 'envelope-2',
      firstKeychainPublish: 'ambiguous',
    });
  });

  it('arms a new record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());

    await store.arm(recordFor(identityId.valueOf()));

    await expect(store.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'armed',
    });
  });

  it('replaces a record whose first publish is still armed', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.arm(recordFor(identityId.valueOf()));

    await store.arm(
      recordFor(identityId.valueOf(), {
        deviceId: 'device-2',
        envelope: 'envelope-2',
      }),
    );

    await expect(store.find(identityId)).resolves.toMatchObject({
      deviceId: 'device-2',
      envelope: 'envelope-2',
      firstKeychainPublish: 'armed',
    });
  });

  it.each(['none', 'ambiguous', undefined] as const)(
    'refuses to arm over a record whose marker is %s and leaves it alone',
    async (firstKeychainPublish) => {
      const store = new IndexedDbDeviceIdentityVaultStore();
      const identityId = IdentityId.fromString(randomUUID());
      const existing = recordFor(identityId.valueOf(), {
        firstKeychainPublish,
      });

      if (!firstKeychainPublish) delete existing.firstKeychainPublish;

      await store.save(existing);

      await expect(
        store.arm(recordFor(identityId.valueOf(), { envelope: 'envelope-2' })),
      ).rejects.toThrow();

      await expect(store.find(identityId)).resolves.toEqual(existing);
    },
  );

  it('refuses to arm over a record that is not version 2', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    const legacy = {
      ...recordFor(identityId.valueOf()),
      version: 1,
    } as unknown as DeviceIdentityVaultRecord;
    await store.save(legacy);

    await expect(
      store.arm(recordFor(identityId.valueOf(), { envelope: 'envelope-2' })),
    ).rejects.toThrow();
    await expect(store.find(identityId)).resolves.toEqual(legacy);
  });

  it('refuses a marker write for an identity that has no vault record', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());

    await expect(store.clearFirstKeychainPublish(identityId)).rejects.toThrow();
    await expect(
      store.transitionFirstKeychainPublish(identityId, 'armed', 'ambiguous'),
    ).rejects.toThrow();
    await expect(store.find(identityId)).resolves.toBeUndefined();
  });

  it('refuses a marker write for a vault record that is not version 2 and leaves its marker alone', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save({
      ...recordFor(identityId.valueOf()),
      version: 1,
    } as unknown as DeviceIdentityVaultRecord);

    await expect(
      store.transitionFirstKeychainPublish(identityId, 'armed', 'ambiguous'),
    ).rejects.toThrow();
    await expect(store.clearFirstKeychainPublish(identityId)).rejects.toThrow();
    await expect(store.find(identityId)).resolves.toMatchObject({
      firstKeychainPublish: 'armed',
    });
  });

  it('keeps the marker when a save omits it', async () => {
    const store = new IndexedDbDeviceIdentityVaultStore();
    const identityId = IdentityId.fromString(randomUUID());
    await store.save(recordFor(identityId.valueOf()));
    await store.transitionFirstKeychainPublish(
      identityId,
      'armed',
      'ambiguous',
    );

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
