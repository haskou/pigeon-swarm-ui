import type { PrivateKeyPackage } from 'ts-mls';

import type { MlsStateStore } from './MlsStateStore';
import type { StoredMlsKeyPackage } from './StoredMlsKeyPackage';

const DATABASE_VERSION = 1;
const STORE_NAME = 'entries';

type Entry = Uint8Array | string | StoredMlsKeyPackage<PrivateKeyPackage>;

/**
 * MLS group state, key package secrets and decrypted plaintexts for one
 * identity on one device. The database is never synced or shared.
 */
export class IndexedDbMlsStateStore implements MlsStateStore {
  public constructor(
    private readonly databaseName: string,
    private readonly identityId: string,
  ) {}

  public async deleteKeyPackage(id: string): Promise<void> {
    await this.run('readwrite', (store) =>
      store.delete(this.key('key-package', id)),
    );
  }

  public async loadGroup(groupId: string): Promise<Uint8Array | undefined> {
    return this.run<Uint8Array | undefined>('readonly', (store) =>
      store.get(this.key('group', groupId)),
    );
  }

  public async loadKeyPackages(): Promise<
    StoredMlsKeyPackage<PrivateKeyPackage>[]
  > {
    const prefix = this.key('key-package', '');

    return this.run<StoredMlsKeyPackage<PrivateKeyPackage>[]>(
      'readonly',
      (store) => store.getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`)),
    );
  }

  public async loadPlaintext(
    groupId: string,
    ciphertextId: string,
  ): Promise<string | undefined> {
    return this.run<string | undefined>('readonly', (store) =>
      store.get(this.key('plaintext', `${groupId}/${ciphertextId}`)),
    );
  }

  public async saveGroup(groupId: string, state: Uint8Array): Promise<void> {
    await this.put(this.key('group', groupId), state);
  }

  public async saveKeyPackage(
    keyPackage: StoredMlsKeyPackage<PrivateKeyPackage>,
  ): Promise<void> {
    await this.put(this.key('key-package', keyPackage.id), keyPackage);
  }

  public async savePlaintext(
    groupId: string,
    ciphertextId: string,
    plaintext: string,
  ): Promise<void> {
    await this.put(
      this.key('plaintext', `${groupId}/${ciphertextId}`),
      plaintext,
    );
  }

  private key(kind: string, id: string): string {
    return `${this.identityId}/${kind}/${id}`;
  }

  private async put(key: string, value: Entry): Promise<void> {
    await this.run('readwrite', (store) => store.put(value, key));
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);

      request.addEventListener('error', () => reject(request.error));
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('upgradeneeded', () => {
        request.result.createObjectStore(STORE_NAME);
      });
    });
  }

  private async run<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const database = await this.open();

    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = callback(transaction.objectStore(STORE_NAME));

        request.addEventListener('error', () => reject(request.error));
        transaction.addEventListener('error', () => reject(transaction.error));
        // Resolve on commit, not on request success: durable before we go on.
        transaction.addEventListener('complete', () =>
          resolve(request.result as T),
        );
      });
    } finally {
      database.close();
    }
  }
}
