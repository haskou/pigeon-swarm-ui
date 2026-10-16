import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedCanaryRecord } from './DeviceSealedCanaryRecord';
import type { DeviceSealedRowRoots as Roots } from './DeviceSealedRowRoots';
import type { DeviceSealedSettlement as Settlement } from './DeviceSealedSettlement';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';
import { DeviceSealedCanaryRecords as Records } from './DeviceSealedCanaryRecords';

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const ROW_PURPOSE = 'row';

function entryKey(identityId: string, id: string): string {
  return `${identityId}\u0000${id}`;
}

function identityRange(identityId: string): IDBKeyRange {
  return IDBKeyRange.bound(
    `${identityId}\u0000`,
    `${identityId}\u0001`,
    false,
    true,
  );
}

/** The rows of `sealedRows` that open under `keys`. */
function openRows<Row>(
  keys: DeviceRootRowKeys,
  sealedRows: readonly { sealed: Uint8Array }[],
): Row[] {
  const rows: Row[] = [];

  for (const { sealed } of sealedRows) {
    const plaintext = keys.open(ROW_PURPOSE, [], sealed);

    if (plaintext) {
      rows.push(JSON.parse(new TextDecoder().decode(plaintext)) as Row);
    }
  }

  return rows;
}

function openDatabase(name: string): Promise<IDBDatabase> {
  const opening = indexedDB.open(name, DATABASE_VERSION);

  opening.addEventListener('upgradeneeded', () => {
    opening.result.createObjectStore(ENTRIES_STORE);
    opening.result.createObjectStore(CANARIES_STORE);
  });

  return indexedDbRequest(opening);
}

/** Drops every row of one identity and its canary, in one transaction. */
function wipeIdentity(transaction: IDBTransaction, identityId: string): void {
  transaction.objectStore(ENTRIES_STORE).delete(identityRange(identityId));
  transaction.objectStore(CANARIES_STORE).delete(identityId);
}

/**
 * Re-seals every row of the identity from the `replaced` keys under the
 * `current` ones within `transaction`, then swaps the canary, records the
 * session's generation and lists the replaced root. A row that does not open
 * is dropped. Any failure aborts the transaction, so the rows stay whole under
 * the replaced root.
 */
function resealWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord,
  roots: Roots & { readonly replaced: DeviceRootRowKeys },
  settled: (settlement: Settlement) => void,
): void {
  const { current, replaced } = roots;
  const entries = transaction.objectStore(ENTRIES_STORE);
  const keys = entries.getAllKeys(identityRange(identityId));
  const rows = entries.getAll(identityRange(identityId)) as IDBRequest<
    { sealed: Uint8Array }[]
  >;

  // Requests of one transaction complete in order: `keys` is done.
  rows.addEventListener('success', () => {
    try {
      let resealed = 0;

      rows.result.forEach(({ sealed }, index) => {
        const key = keys.result[index];
        const plaintext = replaced.open(ROW_PURPOSE, [], sealed);

        if (!plaintext) {
          entries.delete(key);

          return;
        }
        entries.put({ sealed: current.seal(ROW_PURPOSE, [], plaintext) }, key);
        resealed += 1;
      });
      transaction
        .objectStore(CANARIES_STORE)
        .put(Records.resealed(held, roots), identityId);
      settled({
        dropped: rows.result.length - resealed,
        refused: false,
        resealed,
      });
    } catch {
      transaction.abort();
    }
  });
}

/**
 * Drops every row of the identity within `transaction` and renews its
 * canary under `current` (see `DeviceSealedCanaryRecords.renewed`).
 */
function renewWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord | undefined,
  roots: Roots,
): void {
  wipeIdentity(transaction, identityId);
  transaction
    .objectStore(CANARIES_STORE)
    .put(Records.renewed(held, roots), identityId);
}

/**
 * Lists the `replaced` root in `held` within `transaction`, once, and records
 * the later of the stored and the session's generation of the current root.
 */
function retireWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord,
  roots: Roots,
): void {
  const record = Records.retired(held, roots);

  if (record) transaction.objectStore(CANARIES_STORE).put(record, identityId);
}

/**
 * Brings the identity's canary record to the `current` root within
 * `transaction`, read-write on both stores, deciding on the record as stored
 * now (see `decide`), then calls `settled` so the caller writes in the same
 * transaction. A refusal aborts the transaction.
 */
function settle(
  transaction: IDBTransaction,
  identityId: string,
  roots: Roots,
  settled: (settlement: Settlement) => void,
): void {
  const stored = transaction
    .objectStore(CANARIES_STORE)
    .get(identityId) as IDBRequest<DeviceSealedCanaryRecord | undefined>;

  stored.addEventListener('success', () => {
    const held = stored.result;
    const decided = Records.decide(held, roots);

    if (decided === 'refuse') {
      settled({ refused: true });
      transaction.abort();
    } else if (decided === 'retire' && held) {
      retireWithin(transaction, identityId, held, roots);
      settled({ refused: false });
    } else if (decided === 'reseal' && held && roots.replaced) {
      resealWithin(
        transaction,
        identityId,
        held,
        { ...roots, replaced: roots.replaced },
        settled,
      );
    } else {
      renewWithin(transaction, identityId, held, roots);
      settled({ refused: false });
    }
  });
}

/**
 * Rows of one identity, each sealed with AES-GCM under a key derived from the
 * device-sealed root and `label`, so no row content is readable at rest.
 * Without a device-sealed root the store keeps nothing. Failures log one
 * count-only line naming `logName`.
 *
 * A canary per identity tells whether the rows were sealed under the
 * session's root. When it opens only under the root the session replaced, as
 * after a device revoke, the rows are re-sealed under the current root in one
 * transaction, so nothing pending is lost. The canary record lists the latest
 * roots the session replaced, and a listed root is refused in any tab or store
 * instance. It also records the generation of the publication its root came
 * from: generations of one identity only move forward, so a session whose
 * root was published at a generation the record's does not exceed is refused
 * and the newer rows kept. When the canary opens under neither root and the
 * session's root is newer, or the two cannot be ordered, the identity's rows
 * are dropped; only a root known to be older is listed, so no session in use
 * is locked out. Every write and every load decides on the canary as stored
 * in its own transaction.
 */
export class DeviceSealedRowStore<Row extends { readonly id: string }> {
  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
    private readonly logName: string,
  ) {}

  /**
   * The row keys of the session's root and of the root it replaced, and the
   * generation of the session's root.
   */
  private roots(session: Session, root: SymmetricKey): Roots {
    const identityId = session.identity.id;
    const previous = session.previousDeviceSealedRootKey;

    return {
      current: DeviceRootRowKeys.derive(root, this.label, identityId),
      generation: session.deviceSealedRootGeneration?.valueOf(),
      replaced: previous
        ? DeviceRootRowKeys.derive(previous, this.label, identityId)
        : undefined,
    };
  }

  /**
   * Settles the identity's canary record for `roots` in one read-write
   * transaction, then runs `write` in it. Rejects for a root the record lists
   * as replaced or knows to be older. Logs only counts after a re-seal.
   */
  private async settleWith(
    database: IDBDatabase,
    identityId: string,
    roots: Roots,
    write: (entries: IDBObjectStore) => void,
  ): Promise<void> {
    const transaction = database.transaction(
      [ENTRIES_STORE, CANARIES_STORE],
      'readwrite',
    );
    let settlement: Settlement = { refused: false };

    settle(transaction, identityId, roots, (decided) => {
      settlement = decided;

      if (!decided.refused) write(transaction.objectStore(ENTRIES_STORE));
    });

    try {
      await indexedDbTransaction(transaction);
    } catch (error) {
      if (settlement.refused) throw new Error(Records.REPLACED_ROOT);

      throw error;
    }

    if (settlement.resealed !== undefined) {
      // eslint-disable-next-line no-console
      console.info(
        `${this.logName} re-sealed ${settlement.resealed} rows and dropped ${settlement.dropped ?? 0}.`,
      );
    }
  }

  /**
   * Persists a row, in the transaction that settles the canary record, so a
   * row is never written under a root another tab replaced. Rejects on
   * failure.
   */
  public async save(session: Session, row: Row): Promise<void> {
    const root = session.deviceSealedRootKey;

    if (!root) return;

    const identityId = session.identity.id;

    try {
      const database = await openDatabase(this.databaseName);
      const roots = this.roots(session, root);
      const sealed = roots.current.seal(
        ROW_PURPOSE,
        [],
        new TextEncoder().encode(JSON.stringify(row)),
      );

      await this.settleWith(database, identityId, roots, (entries) =>
        entries.put({ sealed }, entryKey(identityId, row.id)),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug(`${this.logName} save failed.`);

      throw error;
    }
  }

  /**
   * Loads this identity's rows under the current root. Empty without one.
   * Reads the canary and the rows in one transaction, and writes only when the
   * canary record has to change, reading the rows in that write. Rejects for
   * a root the canary record lists as replaced or knows to be older.
   */
  public async load(session: Session): Promise<Row[]> {
    const root = session.deviceSealedRootKey;

    if (!root) return [];

    const identityId = session.identity.id;
    const database = await openDatabase(this.databaseName);
    const roots = this.roots(session, root);
    const reading = database.transaction(
      [ENTRIES_STORE, CANARIES_STORE],
      'readonly',
    );
    const [held, sealedRows] = await Promise.all([
      indexedDbRequest(
        reading.objectStore(CANARIES_STORE).get(identityId) as IDBRequest<
          DeviceSealedCanaryRecord | undefined
        >,
      ),
      indexedDbRequest(
        reading
          .objectStore(ENTRIES_STORE)
          .getAll(identityRange(identityId)) as IDBRequest<
          { sealed: Uint8Array }[]
        >,
      ),
    ]);

    if (Records.isRetired(held, roots.current)) {
      throw new Error(Records.REPLACED_ROOT);
    }

    if (Records.isSettled(held, roots)) {
      return openRows<Row>(roots.current, sealedRows);
    }

    let settledRows: { sealed: Uint8Array }[] = [];

    await this.settleWith(database, identityId, roots, (entries) => {
      const rows = entries.getAll(identityRange(identityId)) as IDBRequest<
        { sealed: Uint8Array }[]
      >;

      rows.addEventListener('success', () => {
        settledRows = rows.result;
      });
    });

    return openRows<Row>(roots.current, settledRows);
  }

  /** Removes one row. Rejects on failure. */
  public async remove(identityId: string, id: string): Promise<void> {
    const database = await openDatabase(this.databaseName);
    const transaction = database.transaction(ENTRIES_STORE, 'readwrite');

    transaction.objectStore(ENTRIES_STORE).delete(entryKey(identityId, id));
    await indexedDbTransaction(transaction);
  }

  /**
   * Wipes one identity's rows and canary. Never throws; logs one count-only
   * line.
   */
  public async forget(identityId: string): Promise<void> {
    try {
      const database = await openDatabase(this.databaseName);
      const transaction = database.transaction(
        [ENTRIES_STORE, CANARIES_STORE],
        'readwrite',
      );

      wipeIdentity(transaction, identityId);
      await indexedDbTransaction(transaction);
    } catch {
      // eslint-disable-next-line no-console
      console.debug(`${this.logName} forget failed.`);
    }
  }
}
