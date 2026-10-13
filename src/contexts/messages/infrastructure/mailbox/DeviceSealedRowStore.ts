import type { Session } from '../../../identities/infrastructure/session/Session';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';
import { DeviceRootRowCipher } from './DeviceRootRowCipher';

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';

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

function rowAad(identityId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(['row', identityId]));
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
 * The identity's cipher under this root. A canary sealed under the same key
 * detects a root change; on a mismatch or a missing canary the identity's rows
 * are dropped and the canary is re-sealed under the current root.
 */
async function verifiedCipher(
  database: IDBDatabase,
  label: string,
  identityId: string,
  root: Uint8Array,
): Promise<DeviceRootRowCipher> {
  const cipher = await DeviceRootRowCipher.derive(root, label, identityId);
  const canary = await indexedDbRequest(
    database
      .transaction(CANARIES_STORE, 'readonly')
      .objectStore(CANARIES_STORE)
      .get(identityId) as IDBRequest<
      { sealed: Uint8Array<ArrayBuffer> } | undefined
    >,
  );

  if (canary && (await cipher.opensCanary(canary.sealed))) return cipher;

  const sealedCanary = await cipher.sealCanary();
  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );

  wipeIdentity(transaction, identityId);
  transaction
    .objectStore(CANARIES_STORE)
    .put({ sealed: sealedCanary }, identityId);
  await indexedDbTransaction(transaction);

  return cipher;
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
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return;

    const identityId = session.identity.id;

    try {
      const database = await openDatabase(this.databaseName);
      const cipher = await verifiedCipher(
        database,
        this.label,
        identityId,
        root,
      );
      const sealed = await cipher.seal(
        rowAad(identityId),
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
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return [];

    const identityId = session.identity.id;
    const database = await openDatabase(this.databaseName);
    const cipher = await verifiedCipher(database, this.label, identityId, root);
    const sealedRows = await indexedDbRequest(
      database
        .transaction(ENTRIES_STORE, 'readonly')
        .objectStore(ENTRIES_STORE)
        .getAll(identityRange(identityId)) as IDBRequest<
        { sealed: Uint8Array<ArrayBuffer> }[]
      >,
    );
    const rows: Row[] = [];

    for (const { sealed } of sealedRows) {
      const plaintext = await cipher.open(rowAad(identityId), sealed);

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
