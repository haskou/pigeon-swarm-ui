import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type {
  DeviceIdentityVaultRecord,
  FirstKeychainPublishState,
} from './DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultStore as VaultStore } from './DeviceIdentityVaultStore';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';

const DATABASE_NAME = scopeClientStorageKey('pigeon-swarm-device-vault');
const DATABASE_VERSION = 1;
const STORE_NAME = 'identities';

export class IndexedDbDeviceIdentityVaultStore implements VaultStore {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.addEventListener('error', () => reject(request.error));
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'identityId' });
        }
      });
    });
  }

  private async request<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open();

    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = callback(transaction.objectStore(STORE_NAME));

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => resolve(request.result));
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }

  // Moves the marker to `to` in one transaction, only while it still holds
  // `from` (a record without a marker holds none); an undefined `from` writes
  // unconditionally. Answers whether the marker was written.
  private async writeFirstKeychainPublish(
    identityId: IdentityId,
    from: FirstKeychainPublishState | undefined,
    to: FirstKeychainPublishState,
  ): Promise<boolean> {
    const database = await this.open();

    try {
      return await new Promise<boolean>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(identityId.valueOf());
        let written = false;

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => {
          const record = request.result as
            | DeviceIdentityVaultRecord
            | undefined;

          if (record?.version !== 2) {
            transaction.abort();
            reject(
              new Error(
                'No version 2 vault record holds the first-publish marker, so it was not set.',
              ),
            );

            return;
          }

          if (from && (record.firstKeychainPublish ?? 'none') !== from) {
            return;
          }

          store.put({
            ...record,
            firstKeychainPublish: to,
            updatedAt: Date.now(),
          } satisfies DeviceIdentityVaultRecord);
          written = true;
        });
        transaction.addEventListener('complete', () => resolve(written));
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }

  public async advanceAuthorization(
    identityId: IdentityId,
    previousRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
  ): Promise<void> {
    await this.synchronizeAuthorization(
      identityId,
      previousRevision,
      epoch,
      previousRevision.next(),
    );
  }

  public async synchronizeAuthorization(
    identityId: IdentityId,
    localRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
    revision: DeviceAuthorizationRevision,
  ): Promise<void> {
    const database = await this.open();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(identityId.valueOf());

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => {
          const record = request.result as
            | DeviceIdentityVaultRecord
            | undefined;

          if (
            record?.version !== 2 ||
            !localRevision.hasValue(record.authorizationRevision) ||
            revision.isLessThan(localRevision) ||
            (revision.isEqual(localRevision) &&
              !epoch.hasValue(record.authorizationEpoch))
          ) {
            transaction.abort();
            reject(new Error('Local authorization checkpoint changed.'));

            return;
          }

          store.put({
            ...record,
            authorizationEpoch: epoch.valueOf(),
            authorizationRevision: revision.valueOf(),
            updatedAt: Date.now(),
          } satisfies DeviceIdentityVaultRecord);
        });
        transaction.addEventListener('complete', () => resolve());
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }

  public async delete(identityId: IdentityId): Promise<void> {
    await this.request('readwrite', (store) =>
      store.delete(identityId.valueOf()),
    );
  }

  public async clearFirstKeychainPublish(
    identityId: IdentityId,
  ): Promise<void> {
    await this.writeFirstKeychainPublish(identityId, undefined, 'none');
  }

  public async transitionFirstKeychainPublish(
    identityId: IdentityId,
    from: FirstKeychainPublishState,
    to: FirstKeychainPublishState,
  ): Promise<boolean> {
    return await this.writeFirstKeychainPublish(identityId, from, to);
  }

  public async find(
    identityId: IdentityId,
  ): Promise<DeviceIdentityVaultRecord | undefined> {
    return await this.request<DeviceIdentityVaultRecord | undefined>(
      'readonly',
      (store) =>
        store.get(identityId.valueOf()) as IDBRequest<
          DeviceIdentityVaultRecord | undefined
        >,
    );
  }

  public async save(record: DeviceIdentityVaultRecord): Promise<void> {
    const database = await this.open();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(record.identityId);

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => {
          const existing = request.result as
            | DeviceIdentityVaultRecord
            | undefined;

          // A save without a marker keeps the stored one, so a registration
          // cannot clear a pending first publish.
          store.put({
            ...record,
            firstKeychainPublish:
              record.firstKeychainPublish ?? existing?.firstKeychainPublish,
          } satisfies DeviceIdentityVaultRecord);
        });
        transaction.addEventListener('complete', () => resolve());
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }

  public async arm(record: DeviceIdentityVaultRecord): Promise<void> {
    const database = await this.open();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(record.identityId);

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => {
          const existing = request.result as
            | DeviceIdentityVaultRecord
            | undefined;

          // Only a record whose first publish never started may be replaced:
          // an armed record sent no first keychain, so arming again cannot
          // reopen a publish that may already have reached the node.
          if (
            existing &&
            (existing.version !== 2 ||
              existing.firstKeychainPublish !== 'armed')
          ) {
            transaction.abort();
            reject(new Error('Vault record already exists.'));

            return;
          }

          store.put(record);
        });
        transaction.addEventListener('complete', () => resolve());
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }

  public async replaceProtection(
    expected: DeviceIdentityVaultRecord,
    next: DeviceIdentityVaultRecord,
  ): Promise<void> {
    const database = await this.open();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(expected.identityId);

        request.addEventListener('error', () => reject(request.error));
        request.addEventListener('success', () => {
          const record = request.result as
            | DeviceIdentityVaultRecord
            | undefined;

          if (
            record?.authorizationEpoch !== expected.authorizationEpoch ||
            record.authorizationRevision !== expected.authorizationRevision
          ) {
            transaction.abort();
            reject(new Error('Local authorization checkpoint changed.'));

            return;
          }

          // A password change keeps the live marker, so a stale copy cannot
          // revert a first publish state already recorded.
          store.put({
            ...next,
            firstKeychainPublish: record.firstKeychainPublish,
          } satisfies DeviceIdentityVaultRecord);
        });
        transaction.addEventListener('complete', () => resolve());
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }
}
