import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedCanaryRecord } from './DeviceSealedCanaryRecord';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';

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

/** Whether the record lists the root behind `keys` as replaced. */
function isRetired(
  record: DeviceSealedCanaryRecord | undefined,
  keys: DeviceRootRowKeys,
): boolean {
  return (record?.retired ?? []).some((sealed) => keys.opensCanary(sealed));
}

/**
 * The canary record for `current`: the `held` record's retired roots, plus
 * `replaced` when it is not listed yet.
 */
function canaryRecord(
  current: DeviceRootRowKeys,
  held: DeviceSealedCanaryRecord | undefined,
  replaced: DeviceRootRowKeys | undefined,
): DeviceSealedCanaryRecord {
  const retired = held?.retired ?? [];

  return {
    retired:
      replaced && !isRetired(held, replaced)
        ? [...retired, replaced.sealCanary()]
        : retired,
    sealed: current.sealCanary(),
  };
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
 * Drops every row of the identity and stores a canary for `current` that
 * keeps the retired roots of `held` and lists `replaced`, in one transaction.
 */
async function renew(
  database: IDBDatabase,
  identityId: string,
  current: DeviceRootRowKeys,
  held: DeviceSealedCanaryRecord | undefined,
  replaced: DeviceRootRowKeys | undefined,
): Promise<void> {
  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );

  wipeIdentity(transaction, identityId);
  transaction
    .objectStore(CANARIES_STORE)
    .put(canaryRecord(current, held, replaced), identityId);
  await indexedDbTransaction(transaction);
}

/**
 * Re-seals every row of the identity from the keys of the replaced root under
 * the current ones and swaps the canary, listing the replaced root as
 * retired, in one transaction, only while the canary still opens under the
 * replaced root. A row that does not open is dropped. Any failure aborts the
 * transaction, so the rows stay whole under the replaced root. When the
 * canary already opens under the current root, as after a re-seal elsewhere,
 * nothing changes. Resolves with the re-sealed and dropped counts.
 */
async function reseal(
  database: IDBDatabase,
  identityId: string,
  replaced: DeviceRootRowKeys,
  current: DeviceRootRowKeys,
): Promise<{ dropped: number; resealed: number }> {
  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );
  const entries = transaction.objectStore(ENTRIES_STORE);
  const canaries = transaction.objectStore(CANARIES_STORE);
  const held = canaries.get(identityId) as IDBRequest<
    DeviceSealedCanaryRecord | undefined
  >;
  const keys = entries.getAllKeys(identityRange(identityId));
  const rows = entries.getAll(identityRange(identityId)) as IDBRequest<
    { sealed: Uint8Array }[]
  >;
  const counts = { dropped: 0, resealed: 0 };

  // Requests of one transaction complete in order: `held` and `keys` are done.
  rows.addEventListener('success', () => {
    const canary = held.result;

    if (canary && current.opensCanary(canary.sealed)) return;

    if (!canary || !replaced.opensCanary(canary.sealed)) {
      transaction.abort();

      return;
    }

    try {
      rows.result.forEach(({ sealed }, index) => {
        const key = keys.result[index];
        const plaintext = replaced.open(ROW_PURPOSE, [], sealed);

        if (!plaintext) {
          entries.delete(key);
          counts.dropped += 1;

          return;
        }
        entries.put({ sealed: current.seal(ROW_PURPOSE, [], plaintext) }, key);
        counts.resealed += 1;
      });
      canaries.put(canaryRecord(current, canary, replaced), identityId);
    } catch {
      transaction.abort();
    }
  });
  await indexedDbTransaction(transaction);

  return counts;
}

/**
 * Lists the replaced root as retired on the canary record, in one
 * transaction, while the canary still opens under the current root and does
 * not list it yet. Writes nothing when the `held` record already lists it.
 */
async function retire(
  database: IDBDatabase,
  identityId: string,
  held: DeviceSealedCanaryRecord,
  replaced: DeviceRootRowKeys,
  current: DeviceRootRowKeys,
): Promise<void> {
  if (isRetired(held, replaced)) return;

  const transaction = database.transaction(CANARIES_STORE, 'readwrite');
  const canaries = transaction.objectStore(CANARIES_STORE);
  const stored = canaries.get(identityId) as IDBRequest<
    DeviceSealedCanaryRecord | undefined
  >;

  stored.addEventListener('success', () => {
    const canary = stored.result;

    if (!canary || !current.opensCanary(canary.sealed)) return;

    if (isRetired(canary, replaced)) return;

    canaries.put(
      {
        ...canary,
        retired: [...(canary.retired ?? []), replaced.sealCanary()],
      },
      identityId,
    );
  });
  await indexedDbTransaction(transaction);
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
 * identity's rows are dropped. The canary record lists every root the session
 * replaced, and a listed root is refused in any tab or store instance, so a
 * stale session never drops newer rows.
 */
export class DeviceSealedRowStore<Row extends { readonly id: string }> {
  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
    private readonly logName: string,
  ) {}

  /** Re-seals the rows from the replaced root and logs only the counts. */
  private async resealFrom(
    database: IDBDatabase,
    identityId: string,
    replaced: DeviceRootRowKeys,
    current: DeviceRootRowKeys,
  ): Promise<void> {
    const { dropped, resealed } = await reseal(
      database,
      identityId,
      replaced,
      current,
    );

    // eslint-disable-next-line no-console
    console.info(
      `${this.logName} re-sealed ${resealed} rows and dropped ${dropped}.`,
    );
  }

  /**
   * The identity's row keys under this root, once its rows are known to be
   * sealed under it. Rejects for a root the canary record lists as replaced.
   */
  private async verifiedKeys(
    database: IDBDatabase,
    session: Session,
    root: SymmetricKey,
  ): Promise<DeviceRootRowKeys> {
    const identityId = session.identity.id;
    const keys = DeviceRootRowKeys.derive(root, this.label, identityId);
    const previous = session.previousDeviceSealedRootKey;
    const replaced = previous
      ? DeviceRootRowKeys.derive(previous, this.label, identityId)
      : undefined;
    const canary = await indexedDbRequest(
      database
        .transaction(CANARIES_STORE, 'readonly')
        .objectStore(CANARIES_STORE)
        .get(identityId) as IDBRequest<DeviceSealedCanaryRecord | undefined>,
    );

    if (isRetired(canary, keys)) {
      throw new Error('Device sealed root was replaced.');
    }

    if (!canary) {
      await renew(database, identityId, keys, canary, replaced);
    } else if (keys.opensCanary(canary.sealed)) {
      if (replaced) await retire(database, identityId, canary, replaced, keys);
    } else if (replaced?.opensCanary(canary.sealed)) {
      await this.resealFrom(database, identityId, replaced, keys);
    } else {
      await renew(database, identityId, keys, canary, replaced);
    }

    return keys;
  }

  /** Persists a row. Rejects on failure. */
  public async save(session: Session, row: Row): Promise<void> {
    const root = session.deviceSealedRootKey;

    if (!root) return;

    const identityId = session.identity.id;

    try {
      const database = await openDatabase(this.databaseName);
      const keys = await this.verifiedKeys(database, session, root);
      const sealed = keys.seal(
        ROW_PURPOSE,
        [],
        new TextEncoder().encode(JSON.stringify(row)),
      );
      const transaction = database.transaction(ENTRIES_STORE, 'readwrite');

      transaction
        .objectStore(ENTRIES_STORE)
        .put({ sealed }, entryKey(identityId, row.id));
      await indexedDbTransaction(transaction);
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
