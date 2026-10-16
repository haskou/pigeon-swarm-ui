import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
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
 * Re-seals every row of the identity from the keys of the replaced root under
 * the current ones and swaps the canary, in one transaction, only while the
 * canary still opens under the replaced root. A row that does not open is
 * dropped. When the canary already opens under the current root, as after a
 * re-seal elsewhere, nothing changes. Resolves with the re-sealed count.
 */
async function reseal(
  database: IDBDatabase,
  identityId: string,
  replaced: DeviceRootRowKeys,
  current: DeviceRootRowKeys,
): Promise<number> {
  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );
  const entries = transaction.objectStore(ENTRIES_STORE);
  const canaries = transaction.objectStore(CANARIES_STORE);
  const held = canaries.get(identityId) as IDBRequest<
    { sealed: Uint8Array } | undefined
  >;
  const keys = entries.getAllKeys(identityRange(identityId));
  const rows = entries.getAll(identityRange(identityId)) as IDBRequest<
    { sealed: Uint8Array }[]
  >;
  let resealed = 0;

  // Requests of one transaction complete in order: `held` and `keys` are done.
  rows.addEventListener('success', () => {
    const canary = held.result?.sealed;

    if (canary && current.opensCanary(canary)) return;

    if (!canary || !replaced.opensCanary(canary)) {
      transaction.abort();

      return;
    }
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
    canaries.put({ sealed: current.sealCanary() }, identityId);
  });
  await indexedDbTransaction(transaction);

  return resealed;
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
 * identity's rows are dropped. A root this store re-sealed away from is
 * refused, so a stale session never drops newer rows.
 */
export class DeviceSealedRowStore<Row extends { readonly id: string }> {
  private readonly replacedRoots = new Map<string, Set<string>>();

  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
    private readonly logName: string,
  ) {}

  /**
   * The identity's row keys under this root, once its rows are known to be
   * sealed under it. Rejects for a root this store re-sealed away from.
   */
  private async verifiedKeys(
    database: IDBDatabase,
    session: Session,
    root: SymmetricKey,
  ): Promise<DeviceRootRowKeys> {
    const identityId = session.identity.id;
    const replacedRoots = this.replacedRoots.get(identityId) ?? new Set();

    if (replacedRoots.has(encodeBase64Url(root.getBuffer()))) {
      throw new Error('Device sealed root was replaced.');
    }
    const keys = DeviceRootRowKeys.derive(root, this.label, identityId);
    const canary = await indexedDbRequest(
      database
        .transaction(CANARIES_STORE, 'readonly')
        .objectStore(CANARIES_STORE)
        .get(identityId) as IDBRequest<{ sealed: Uint8Array } | undefined>,
    );

    if (canary && keys.opensCanary(canary.sealed)) return keys;
    const previous = session.previousDeviceSealedRootKey;

    if (canary && previous) {
      const replaced = DeviceRootRowKeys.derive(
        previous,
        this.label,
        identityId,
      );

      if (replaced.opensCanary(canary.sealed)) {
        const count = await reseal(database, identityId, replaced, keys);

        this.replacedRoots.set(
          identityId,
          replacedRoots.add(encodeBase64Url(previous.getBuffer())),
        );
        // eslint-disable-next-line no-console
        console.info(`${this.logName} re-sealed ${count} rows.`);

        return keys;
      }
    }
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
