import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';

const DATABASE_VERSION = 3;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const READS_STORE = 'reads';
const BY_RECORD_INDEX = 'byRecord';
const BY_CONVERSATION_INDEX = 'byConversation';

/**
 * The IndexedDB tables of the group history. Rows get increasing sequence
 * numbers in arrival order, are indexed by their tags, and are unique per
 * record tag. `reads` keeps one sealed read marker per identity and
 * conversation tag. Opening the database drops the tables of a version
 * before 2 and adds `reads` to a version 2 database, keeping its history.
 */
export class GroupMessageHistoryDatabase {
  private connection: Promise<IDBDatabase> | undefined;

  public constructor(private readonly name: string) {}

  private open(): Promise<IDBDatabase> {
    this.connection ??= this.connect();

    return this.connection;
  }

  private async connect(): Promise<IDBDatabase> {
    const opening = indexedDB.open(this.name, DATABASE_VERSION);

    opening.addEventListener('upgradeneeded', (event) => {
      const database = opening.result;

      if (event.oldVersion < 2) {
        for (const store of [...database.objectStoreNames]) {
          database.deleteObjectStore(store);
        }
        const entries = database.createObjectStore(ENTRIES_STORE, {
          autoIncrement: true,
        });

        entries.createIndex(
          BY_RECORD_INDEX,
          ['identityId', 'conversation', 'record'],
          { unique: true },
        );
        entries.createIndex(BY_CONVERSATION_INDEX, [
          'identityId',
          'conversation',
        ]);
        database.createObjectStore(CANARIES_STORE);
      }

      if (!database.objectStoreNames.contains(READS_STORE)) {
        database.createObjectStore(READS_STORE);
      }
    });

    try {
      const database = await indexedDbRequest(opening);

      database.addEventListener('versionchange', () => {
        database.close();
        this.connection = undefined;
      });

      return database;
    } catch (error) {
      this.connection = undefined;

      throw error;
    }
  }

  private async within<T>(
    stores: string[],
    mode: IDBTransactionMode,
    work: (transaction: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const transaction = (await this.open()).transaction(stores, mode);
    const result = await work(transaction);

    await indexedDbTransaction(transaction);

    return result;
  }

  /** Drops one identity's rows, read markers and canary in `transaction`. */
  private async wipeWithin(
    transaction: IDBTransaction,
    identityId: string,
  ): Promise<void> {
    const entries = transaction.objectStore(ENTRIES_STORE);
    const ofIdentity = IDBKeyRange.bound([identityId], [identityId, []]);
    const sequences = await indexedDbRequest(
      entries.index(BY_CONVERSATION_INDEX).getAllKeys(ofIdentity),
    );

    for (const sequence of sequences) entries.delete(sequence);
    transaction.objectStore(READS_STORE).delete(ofIdentity);
    transaction.objectStore(CANARIES_STORE).delete(identityId);
  }

  public canary(
    identityId: string,
  ): Promise<Uint8Array<ArrayBuffer> | undefined> {
    return this.within([CANARIES_STORE], 'readonly', (transaction) =>
      indexedDbRequest(
        transaction.objectStore(CANARIES_STORE).get(identityId) as IDBRequest<
          Uint8Array<ArrayBuffer> | undefined
        >,
      ),
    );
  }

  /**
   * Adds the rows whose record tag is not stored yet. Resolves with each
   * row's sequence, or undefined for a row already stored.
   */
  public insert(
    rows: readonly GroupMessageHistoryRow[],
  ): Promise<(number | undefined)[]> {
    return this.within([ENTRIES_STORE], 'readwrite', async (transaction) => {
      const entries = transaction.objectStore(ENTRIES_STORE);
      const sequences: (number | undefined)[] = [];

      for (const row of rows) {
        const stored = await indexedDbRequest(
          entries
            .index(BY_RECORD_INDEX)
            .count(
              IDBKeyRange.only([row.identityId, row.conversation, row.record]),
            ),
        );

        sequences.push(
          stored === 0
            ? Number(await indexedDbRequest(entries.add(row)))
            : undefined,
        );
      }

      return sequences;
    });
  }

  /** Stores the sealed read marker of one conversation tag. */
  public putRead(
    identityId: string,
    conversation: string,
    sealed: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    return this.within([READS_STORE], 'readwrite', async (transaction) => {
      await indexedDbRequest(
        transaction
          .objectStore(READS_STORE)
          .put(sealed, [identityId, conversation]),
      );
    });
  }

  /** The sealed read marker of one conversation tag. */
  public read(
    identityId: string,
    conversation: string,
  ): Promise<Uint8Array<ArrayBuffer> | undefined> {
    return this.within([READS_STORE], 'readonly', (transaction) =>
      indexedDbRequest(
        transaction
          .objectStore(READS_STORE)
          .get([identityId, conversation]) as IDBRequest<
          Uint8Array<ArrayBuffer> | undefined
        >,
      ),
    );
  }

  /** Drops one identity's rows and stores its new canary. */
  public reset(
    identityId: string,
    canary: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    return this.within(
      [ENTRIES_STORE, CANARIES_STORE, READS_STORE],
      'readwrite',
      async (transaction) => {
        await this.wipeWithin(transaction, identityId);
        transaction.objectStore(CANARIES_STORE).put(canary, identityId);
      },
    );
  }

  /** The stored row of one record tag. */
  public row(
    identityId: string,
    conversation: string,
    record: string,
  ): Promise<GroupMessageHistoryRow | undefined> {
    return this.within([ENTRIES_STORE], 'readonly', (transaction) =>
      indexedDbRequest(
        transaction
          .objectStore(ENTRIES_STORE)
          .index(BY_RECORD_INDEX)
          .get(
            IDBKeyRange.only([identityId, conversation, record]),
          ) as IDBRequest<GroupMessageHistoryRow | undefined>,
      ),
    );
  }

  /** The rows of `sequences`, in that order. */
  public rows(
    sequences: readonly number[],
  ): Promise<(GroupMessageHistoryRow | undefined)[]> {
    return this.within([ENTRIES_STORE], 'readonly', (transaction) => {
      const entries = transaction.objectStore(ENTRIES_STORE);

      return Promise.all(
        sequences.map((sequence) =>
          indexedDbRequest(
            entries.get(sequence) as IDBRequest<
              GroupMessageHistoryRow | undefined
            >,
          ),
        ),
      );
    });
  }

  /** The sequences of one conversation's rows, in arrival order. */
  public sequences(
    identityId: string,
    conversation: string,
  ): Promise<number[]> {
    return this.within([ENTRIES_STORE], 'readonly', async (transaction) =>
      (
        await indexedDbRequest(
          transaction
            .objectStore(ENTRIES_STORE)
            .index(BY_CONVERSATION_INDEX)
            .getAllKeys(IDBKeyRange.only([identityId, conversation])),
        )
      ).map(Number),
    );
  }

  public wipe(identityId: string): Promise<void> {
    return this.within(
      [ENTRIES_STORE, CANARIES_STORE, READS_STORE],
      'readwrite',
      (transaction) => this.wipeWithin(transaction, identityId),
    );
  }
}
