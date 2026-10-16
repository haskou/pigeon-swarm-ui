import type { DeviceRootRowKeys } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedCanaryRecord as CanaryRecord } from '../../../messages/infrastructure/mailbox/DeviceSealedCanaryRecord';
import type { DeviceSealedRowRoots as Roots } from '../../../messages/infrastructure/mailbox/DeviceSealedRowRoots';
import type { DeviceSealedSettlement as Settlement } from '../../../messages/infrastructure/mailbox/DeviceSealedSettlement';
import type { GroupMessageHistoryResealer as Resealer } from './GroupMessageHistoryResealer';
import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';
import { DeviceSealedCanaryRecords as Records } from '../../../messages/infrastructure/mailbox/DeviceSealedCanaryRecords';

const DATABASE_VERSION = 3;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const READS_STORE = 'reads';
const BY_RECORD_INDEX = 'byRecord';
const BY_CONVERSATION_INDEX = 'byConversation';

/** Every key of one identity in `entries.byConversation` and in `reads`. */
function identityRange(identityId: string): IDBKeyRange {
  return IDBKeyRange.bound([identityId], [identityId, []]);
}

/**
 * The IndexedDB tables of the group history. Rows get increasing sequence
 * numbers in arrival order, are indexed by their tags, and are unique per
 * record tag. `reads` keeps one sealed read marker per identity and
 * conversation tag. Opening the database drops the tables of a version
 * before 2 and adds `reads` to a version 2 database, keeping its history.
 *
 * `canaries` keeps one canary record per identity
 * (`DeviceSealedCanaryRecords`); a bare canary, as stored before the record,
 * reads as one that lists no replaced root. `settle` brings the record to a
 * session's roots in one transaction, re-sealing the rows and read markers
 * from the replaced root in place. Every write first checks, in its own
 * transaction, that the canary still opens under the writer's keys, so a tab
 * on a replaced root never writes under it.
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

  /** Runs `work` in one transaction; a failure aborts it. */
  private async within<T>(
    stores: string[],
    mode: IDBTransactionMode,
    work: (transaction: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const transaction = (await this.open()).transaction(stores, mode);
    let result: T;

    try {
      result = await work(transaction);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // Already finished: nothing it wrote can be taken back.
      }

      throw error;
    }

    await indexedDbTransaction(transaction);

    return result;
  }

  /** The identity's canary record in `transaction`. */
  private async recordWithin(
    transaction: IDBTransaction,
    identityId: string,
  ): Promise<CanaryRecord | undefined> {
    const stored = await indexedDbRequest(
      transaction.objectStore(CANARIES_STORE).get(identityId) as IDBRequest<
        CanaryRecord | Uint8Array | undefined
      >,
    );

    return stored === undefined || 'sealed' in stored
      ? stored
      : { sealed: stored };
  }

  /**
   * Rejects in `transaction`, before it writes, when the identity's canary
   * does not open under `keys`: another tab re-sealed or dropped the history
   * under a newer root, or forgot it.
   */
  private async guardWithin(
    transaction: IDBTransaction,
    identityId: string,
    keys: DeviceRootRowKeys,
  ): Promise<void> {
    const held = await this.recordWithin(transaction, identityId);

    if (!held || !keys.opensCanary(held.sealed)) {
      throw new Error(Records.REPLACED_ROOT);
    }
  }

  /**
   * Moves the identity's read markers in `transaction` from their tags under
   * the replaced root to the ones in `tags`, re-sealed by `resealer`. A
   * marker whose conversation kept no row, or that does not open, is dropped.
   */
  private async moveReadsWithin(
    transaction: IDBTransaction,
    identityId: string,
    tags: ReadonlyMap<string, string>,
    resealer: Resealer,
  ): Promise<void> {
    const reads = transaction.objectStore(READS_STORE);
    const [keys, markers] = await Promise.all([
      indexedDbRequest(reads.getAllKeys(identityRange(identityId))),
      indexedDbRequest(
        reads.getAll(identityRange(identityId)) as IDBRequest<Uint8Array[]>,
      ),
    ]);

    reads.delete(identityRange(identityId));
    markers.forEach((sealed, index) => {
      const [, from] = keys[index] as [string, string];
      const to = tags.get(from);
      const moved =
        to === undefined ? undefined : resealer.read(from, to, sealed);

      if (to !== undefined && moved) reads.put(moved, [identityId, to]);
    });
  }

  /**
   * Drops the identity's rows and read markers in `transaction` and renews
   * its canary record (`DeviceSealedCanaryRecords.renewed`).
   */
  private async renewWithin(
    transaction: IDBTransaction,
    identityId: string,
    held: CanaryRecord | undefined,
    roots: Roots,
  ): Promise<Settlement> {
    const dropped = await this.wipeWithin(transaction, identityId);

    transaction
      .objectStore(CANARIES_STORE)
      .put(Records.renewed(held, roots), identityId);

    return { dropped, refused: false };
  }

  /**
   * Re-seals the identity's rows in `transaction` under the current root,
   * each under its own sequence so arrival order holds, then its read
   * markers, and swaps the canary record
   * (`DeviceSealedCanaryRecords.resealed`). A row that does not open is
   * dropped.
   */
  private async resealWithin(
    transaction: IDBTransaction,
    identityId: string,
    held: CanaryRecord,
    roots: Roots & { readonly replaced: DeviceRootRowKeys },
    resealer: Resealer,
  ): Promise<Settlement> {
    const entries = transaction.objectStore(ENTRIES_STORE);
    const byConversation = entries.index(BY_CONVERSATION_INDEX);
    const [sequences, rows] = await Promise.all([
      indexedDbRequest(byConversation.getAllKeys(identityRange(identityId))),
      indexedDbRequest(
        byConversation.getAll(identityRange(identityId)) as IDBRequest<
          GroupMessageHistoryRow[]
        >,
      ),
    ]);
    const tags = new Map<string, string>();
    let resealed = 0;

    rows.forEach((row, index) => {
      const moved = resealer.row(row);

      if (!moved) {
        entries.delete(sequences[index]);

        return;
      }
      entries.put(moved, sequences[index]);
      tags.set(row.conversation, moved.conversation);
      resealed += 1;
    });
    await this.moveReadsWithin(transaction, identityId, tags, resealer);
    transaction
      .objectStore(CANARIES_STORE)
      .put(Records.resealed(held, roots), identityId);

    return { dropped: rows.length - resealed, refused: false, resealed };
  }

  /** How many rows the identity keeps, in `transaction`. */
  private async sequencesWithin(
    transaction: IDBTransaction,
    identityId: string,
  ): Promise<IDBValidKey[]> {
    return await indexedDbRequest(
      transaction
        .objectStore(ENTRIES_STORE)
        .index(BY_CONVERSATION_INDEX)
        .getAllKeys(identityRange(identityId)),
    );
  }

  /**
   * Drops one identity's rows, read markers and canary in `transaction`.
   * Resolves with the dropped row count.
   */
  private async wipeWithin(
    transaction: IDBTransaction,
    identityId: string,
  ): Promise<number> {
    const entries = transaction.objectStore(ENTRIES_STORE);
    const sequences = await this.sequencesWithin(transaction, identityId);

    for (const sequence of sequences) entries.delete(sequence);
    transaction.objectStore(READS_STORE).delete(identityRange(identityId));
    transaction.objectStore(CANARIES_STORE).delete(identityId);

    return sequences.length;
  }

  /**
   * Adds the rows whose record tag is not stored yet, once the identity's
   * canary opens under `keys`. Resolves with each row's sequence, or
   * undefined for a row already stored.
   */
  public insert(
    identityId: string,
    keys: DeviceRootRowKeys,
    rows: readonly GroupMessageHistoryRow[],
  ): Promise<(number | undefined)[]> {
    return this.within(
      [ENTRIES_STORE, CANARIES_STORE],
      'readwrite',
      async (transaction) => {
        const entries = transaction.objectStore(ENTRIES_STORE);
        const sequences: (number | undefined)[] = [];

        await this.guardWithin(transaction, identityId, keys);

        for (const row of rows) {
          const stored = await indexedDbRequest(
            entries
              .index(BY_RECORD_INDEX)
              .count(
                IDBKeyRange.only([
                  row.identityId,
                  row.conversation,
                  row.record,
                ]),
              ),
          );

          sequences.push(
            stored === 0
              ? Number(await indexedDbRequest(entries.add(row)))
              : undefined,
          );
        }

        return sequences;
      },
    );
  }

  /**
   * Stores the sealed read marker of one conversation tag, once the
   * identity's canary opens under `keys`.
   */
  public putRead(
    identityId: string,
    keys: DeviceRootRowKeys,
    conversation: string,
    sealed: Uint8Array,
  ): Promise<void> {
    return this.within(
      [READS_STORE, CANARIES_STORE],
      'readwrite',
      async (transaction) => {
        await this.guardWithin(transaction, identityId, keys);
        await indexedDbRequest(
          transaction
            .objectStore(READS_STORE)
            .put(sealed, [identityId, conversation]),
        );
      },
    );
  }

  /** The sealed read marker of one conversation tag. */
  public read(
    identityId: string,
    conversation: string,
  ): Promise<Uint8Array | undefined> {
    return this.within([READS_STORE], 'readonly', (transaction) =>
      indexedDbRequest(
        transaction
          .objectStore(READS_STORE)
          .get([identityId, conversation]) as IDBRequest<
          Uint8Array | undefined
        >,
      ),
    );
  }

  /**
   * Settles the identity's canary record for `roots` in one transaction
   * (`DeviceSealedCanaryRecords.decide`): rejects with `REPLACED_ROOT` for a
   * refused root, keeping the rows; re-seals the rows and read markers from
   * the replaced root with `resealer`; drops them for any other root; or
   * lists the replaced root and the session's generation.
   */
  public settle(
    identityId: string,
    roots: Roots,
    resealer: Resealer,
  ): Promise<Settlement> {
    return this.within(
      [ENTRIES_STORE, CANARIES_STORE, READS_STORE],
      'readwrite',
      async (transaction) => {
        const held = await this.recordWithin(transaction, identityId);
        const decided = Records.decide(held, roots);
        const { replaced } = roots;

        if (decided === 'refuse') throw new Error(Records.REPLACED_ROOT);

        if (decided === 'reseal' && held && replaced) {
          return await this.resealWithin(
            transaction,
            identityId,
            held,
            { ...roots, replaced },
            resealer,
          );
        }

        if (decided === 'renew' || !held) {
          return await this.renewWithin(transaction, identityId, held, roots);
        }
        const record = Records.retired(held, roots);

        if (record) {
          transaction.objectStore(CANARIES_STORE).put(record, identityId);
        }

        return { refused: false };
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

  public async wipe(identityId: string): Promise<void> {
    await this.within(
      [ENTRIES_STORE, CANARIES_STORE, READS_STORE],
      'readwrite',
      (transaction) => this.wipeWithin(transaction, identityId),
    );
  }
}
