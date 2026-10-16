import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedCanaryRecord } from './DeviceSealedCanaryRecord';
import type { DeviceSealedSettlement as Settlement } from './DeviceSealedSettlement';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const ROW_PURPOSE = 'row';
const REPLACED_ROOT = 'Device sealed root was replaced.';
/** How many replaced roots a canary record lists, the latest ones. */
const MAX_RETIRED = 16;

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

/** Whether the record lists the root behind `keys` as replaced. */
function isRetired(
  record: DeviceSealedCanaryRecord | undefined,
  keys: DeviceRootRowKeys,
): boolean {
  return (record?.retired ?? []).some((sealed) => keys.opensCanary(sealed));
}

/** `retired` plus `added`, keeping only the latest `MAX_RETIRED`. */
function bounded(
  retired: readonly Uint8Array[],
  added: readonly Uint8Array[],
): Uint8Array[] {
  return [...retired, ...added].slice(-MAX_RETIRED);
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
 * `current` ones within `transaction`, then swaps the canary and lists the
 * replaced root. A row that does not open is dropped. Any failure aborts the
 * transaction, so the rows stay whole under the replaced root.
 */
function resealWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord,
  {
    current,
    replaced,
  }: { current: DeviceRootRowKeys; replaced: DeviceRootRowKeys },
  settled: (settlement: Settlement) => void,
): void {
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
      transaction.objectStore(CANARIES_STORE).put(
        {
          retired: bounded(held.retired ?? [], [replaced.sealCanary()]),
          sealed: current.sealCanary(),
        },
        identityId,
      );
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
 * canary under `current`. When the session names a `replaced` root, a
 * rotation skipped on this device replaced the dropped canary's root as well,
 * so both are listed.
 */
function renewWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord | undefined,
  {
    current,
    replaced,
  }: { current: DeviceRootRowKeys; replaced?: DeviceRootRowKeys },
): void {
  const skipped = held && replaced ? [held.sealed] : [];
  const listed = replaced && !isRetired(held, replaced);

  wipeIdentity(transaction, identityId);
  transaction.objectStore(CANARIES_STORE).put(
    {
      retired: bounded(held?.retired ?? [], [
        ...skipped,
        ...(listed ? [replaced.sealCanary()] : []),
      ]),
      sealed: current.sealCanary(),
    },
    identityId,
  );
}

/** Lists the `replaced` root in `held` within `transaction`, once. */
function retireWithin(
  transaction: IDBTransaction,
  identityId: string,
  held: DeviceSealedCanaryRecord,
  replaced: DeviceRootRowKeys | undefined,
): void {
  if (!replaced || isRetired(held, replaced)) return;

  transaction.objectStore(CANARIES_STORE).put(
    {
      ...held,
      retired: bounded(held.retired ?? [], [replaced.sealCanary()]),
    },
    identityId,
  );
}

/**
 * Brings the identity's canary record to the `current` root within
 * `transaction`, read-write on both stores, deciding on the record as stored
 * now, then calls `settled` so the caller writes in the same transaction:
 *
 * - a root the record lists as retired is refused: the transaction aborts;
 * - under the current root, the `replaced` root is listed when it is not yet;
 * - under the replaced root, every row is re-sealed under the current one;
 * - otherwise the rows are dropped and the canary renewed.
 */
function settle(
  transaction: IDBTransaction,
  identityId: string,
  roots: { current: DeviceRootRowKeys; replaced?: DeviceRootRowKeys },
  settled: (settlement: Settlement) => void,
): void {
  const { current, replaced } = roots;
  const stored = transaction
    .objectStore(CANARIES_STORE)
    .get(identityId) as IDBRequest<DeviceSealedCanaryRecord | undefined>;

  stored.addEventListener('success', () => {
    const held = stored.result;

    if (isRetired(held, current)) {
      settled({ refused: true });
      transaction.abort();
    } else if (held && current.opensCanary(held.sealed)) {
      retireWithin(transaction, identityId, held, replaced);
      settled({ refused: false });
    } else if (held && replaced?.opensCanary(held.sealed)) {
      resealWithin(
        transaction,
        identityId,
        held,
        { current, replaced },
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
 * transaction, so nothing pending is lost. When it opens under neither, the
 * identity's rows are dropped. The canary record lists the latest roots the
 * session replaced, and a listed root is refused in any tab or store
 * instance, so a stale session never drops newer rows. Every write decides on
 * the canary as stored in its own transaction.
 */
export class DeviceSealedRowStore<Row extends { readonly id: string }> {
  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
    private readonly logName: string,
  ) {}

  /** The row keys of the session's root and of the root it replaced. */
  private rowKeys(
    session: Session,
    root: SymmetricKey,
  ): { keys: DeviceRootRowKeys; replaced?: DeviceRootRowKeys } {
    const identityId = session.identity.id;
    const previous = session.previousDeviceSealedRootKey;

    return {
      keys: DeviceRootRowKeys.derive(root, this.label, identityId),
      replaced: previous
        ? DeviceRootRowKeys.derive(previous, this.label, identityId)
        : undefined,
    };
  }

  /**
   * Settles the identity's canary record for `keys` in one read-write
   * transaction, then runs `write` in it. Rejects for a root the record lists
   * as replaced. Logs only counts after a re-seal.
   */
  private async settleWith(
    database: IDBDatabase,
    identityId: string,
    keys: DeviceRootRowKeys,
    replaced: DeviceRootRowKeys | undefined,
    write: (entries: IDBObjectStore) => void = () => undefined,
  ): Promise<void> {
    const transaction = database.transaction(
      [ENTRIES_STORE, CANARIES_STORE],
      'readwrite',
    );
    let settlement: Settlement = { refused: false };

    settle(transaction, identityId, { current: keys, replaced }, (decided) => {
      settlement = decided;

      if (!decided.refused) write(transaction.objectStore(ENTRIES_STORE));
    });

    try {
      await indexedDbTransaction(transaction);
    } catch (error) {
      if (settlement.refused) throw new Error(REPLACED_ROOT);

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
   * The identity's row keys under this root, once its rows are known to be
   * sealed under it. Reads first, and writes only when the canary record has
   * to change. Rejects for a root the canary record lists as replaced.
   */
  private async verifiedKeys(
    database: IDBDatabase,
    session: Session,
    root: SymmetricKey,
  ): Promise<DeviceRootRowKeys> {
    const identityId = session.identity.id;
    const { keys, replaced } = this.rowKeys(session, root);
    const canary = await indexedDbRequest(
      database
        .transaction(CANARIES_STORE, 'readonly')
        .objectStore(CANARIES_STORE)
        .get(identityId) as IDBRequest<DeviceSealedCanaryRecord | undefined>,
    );

    if (isRetired(canary, keys)) throw new Error(REPLACED_ROOT);

    const current =
      canary !== undefined &&
      keys.opensCanary(canary.sealed) &&
      (!replaced || isRetired(canary, replaced));

    if (!current) {
      await this.settleWith(database, identityId, keys, replaced);
    }

    return keys;
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
      const { keys, replaced } = this.rowKeys(session, root);
      const sealed = keys.seal(
        ROW_PURPOSE,
        [],
        new TextEncoder().encode(JSON.stringify(row)),
      );

      await this.settleWith(database, identityId, keys, replaced, (entries) =>
        entries.put({ sealed }, entryKey(identityId, row.id)),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug(`${this.logName} save failed.`);

      throw error;
    }
  }

  /** Loads this identity's rows under the current root. Empty without one. */
  public async load(session: Session): Promise<Row[]> {
    const root = session.deviceSealedRootKey;

    if (!root) return [];

    const identityId = session.identity.id;
    const database = await openDatabase(this.databaseName);
    const keys = await this.verifiedKeys(database, session, root);
    const sealedRows = await indexedDbRequest(
      database
        .transaction(ENTRIES_STORE, 'readonly')
        .objectStore(ENTRIES_STORE)
        .getAll(identityRange(identityId)) as IDBRequest<
        { sealed: Uint8Array }[]
      >,
    );
    const rows: Row[] = [];

    for (const { sealed } of sealedRows) {
      const plaintext = keys.open(ROW_PURPOSE, [], sealed);

      if (plaintext) {
        rows.push(JSON.parse(new TextDecoder().decode(plaintext)) as Row);
      }
    }

    return rows;
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
