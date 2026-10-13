import type { GroupMailboxGenerationPrimitives } from '../../domain/GroupMailboxGenerationPrimitives';
import type { GroupMailboxGenerationRepository } from '../../domain/repositories/GroupMailboxGenerationRepository';

import { GroupMailboxGenerationLog } from '../../domain/GroupMailboxGenerationLog';

const DATABASE_VERSION = 1;
const STORE_NAME = 'generations';

/**
 * Generation logs for one identity on one device, keyed per conversation.
 * Stored next to the MLS state that can already derive them.
 */
// eslint-disable-next-line max-len
export class IndexedDbGroupMailboxGenerationStore implements GroupMailboxGenerationRepository {
  public constructor(
    private readonly databaseName: string,
    private readonly identityId: string,
  ) {}

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
        transaction.addEventListener('complete', () =>
          resolve(request.result as T),
        );
      });
    } finally {
      database.close();
    }
  }

  public async load(
    conversationId: string,
  ): Promise<GroupMailboxGenerationLog> {
    const stored = await this.run<
      GroupMailboxGenerationPrimitives[] | undefined
    >('readonly', (store) => store.get(`${this.identityId}/${conversationId}`));

    return stored
      ? GroupMailboxGenerationLog.fromPrimitives(stored)
      : GroupMailboxGenerationLog.empty();
  }

  public async save(
    conversationId: string,
    log: GroupMailboxGenerationLog,
  ): Promise<void> {
    await this.run('readwrite', (store) =>
      store.put(log.toPrimitives(), `${this.identityId}/${conversationId}`),
    );
  }
}
