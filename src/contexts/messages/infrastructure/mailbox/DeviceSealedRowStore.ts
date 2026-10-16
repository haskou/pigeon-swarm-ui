import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';

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
 * The identity's row keys under this root. A canary sealed under the same key
 * detects a root change; on a mismatch or a missing canary the identity's rows
 * are dropped and the canary is re-sealed under the current root.
 */
async function verifiedKeys(
  database: IDBDatabase,
  label: string,
  identityId: string,
  root: SymmetricKey,
): Promise<DeviceRootRowKeys> {
  const keys = DeviceRootRowKeys.derive(root, label, identityId);
  const canary = await indexedDbRequest(
    database
      .transaction(CANARIES_STORE, 'readonly')
      .objectStore(CANARIES_STORE)
      .get(identityId) as IDBRequest<{ sealed: Uint8Array } | undefined>,
  );

  if (canary && keys.opensCanary(canary.sealed)) return keys;

  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );

  wipeIdentity(transaction, identityId);
  transaction
    .objectStore(CANARIES_STORE)
    .put({ sealed: keys.sealCanary() }, identityId);
  await indexedDbTransaction(transaction);

  return keys;
}

/**
 * Rows of one identity, each sealed with AES-GCM under a key derived from the
 * device-sealed root and `label`, so no row content is readable at rest.
 * Without a device-sealed root the store keeps nothing. Failures log one
 * count-only line naming `logName`.
 */
export class DeviceSealedRowStore<Row extends { readonly id: string }> {
  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
    private readonly logName: string,
  ) {}

  /** Persists a row. Rejects on failure. */
  public async save(session: Session, row: Row): Promise<void> {
    const root = session.deviceSealedRootKey;

    if (!root) return;

    const identityId = session.identity.id;

    try {
      const database = await openDatabase(this.databaseName);
      const keys = await verifiedKeys(database, this.label, identityId, root);
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
    const keys = await verifiedKeys(database, this.label, identityId, root);
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
