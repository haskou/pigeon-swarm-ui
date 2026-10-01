import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DeviceIdentityVaultRecord } from './DeviceIdentityVaultRecord';
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

  public async advanceAuthorization(
    identityId: IdentityId,
    previousRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
  ): Promise<void> {
    await this.synchronizeAuthorization(
      identityId,
      previousRevision,
      epoch,
      DeviceAuthorizationRevision.fromNumber(previousRevision.valueOf() + 1),
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
            record.authorizationRevision !== localRevision.valueOf() ||
            revision.valueOf() < localRevision.valueOf() ||
            (revision.isEqual(localRevision) &&
              record.authorizationEpoch !== epoch.valueOf())
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

  public async delete(identityId: IdentityId): Promise<void> {
    await this.request('readwrite', (store) =>
      store.delete(identityId.valueOf()),
    );
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
    await this.request('readwrite', (store) => store.put(record));
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

          store.put(next);
        });
        transaction.addEventListener('complete', () => resolve());
        transaction.addEventListener('error', () => reject(transaction.error));
      });
    } finally {
      database.close();
    }
  }
}
