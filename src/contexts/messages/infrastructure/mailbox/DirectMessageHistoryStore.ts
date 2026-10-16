import { DeviceRootRowKeys } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageHistoryEntry } from './DirectMessageHistoryEntry';
import type { DirectMessageHistoryItem } from './DirectMessageHistoryItem';
import type { DirectMessageHistoryRow } from './DirectMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { DirectMessageHistoryStorageError } from './DirectMessageHistoryStorageError';

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const BY_RECORD_INDEX = 'byRecord';
const BY_SCOPE_INDEX = 'byScope';
const KEYS_LABEL = 'pigeon-direct-history';
const RECORD_PURPOSE = 'record';

/** Drops one identity's rows and canary. Resolves with the dropped count. */
async function wipeIdentity(
  transaction: IDBTransaction,
  identityId: string,
): Promise<number> {
  const entries = transaction.objectStore(ENTRIES_STORE);
  const keys = await indexedDbRequest(
    entries
      .index(BY_SCOPE_INDEX)
      .getAllKeys(IDBKeyRange.bound([identityId], [identityId, []])),
  );

  for (const key of keys) entries.delete(key);

  transaction.objectStore(CANARIES_STORE).delete(identityId);

  return keys.length;
}

/**
 * Decrypted direct-message records kept on this device so the timeline
 * survives logout and re-login. Each record is sealed with AES-GCM under a key
 * derived from the device-sealed root. A canary sealed under the same key
 * detects a root change; the identity's rows are then dropped, so rotating the
 * root drops the history. A drop is remembered until `checkDropped` reports it.
 */
export class DirectMessageHistoryStore {
  private readonly dropped = new Set<string>();

  public constructor(
    private readonly databaseName: string = scopeClientStorageKey(
      'pigeon-direct-history',
    ),
  ) {}

  private async insert(rows: DirectMessageHistoryRow[]): Promise<void> {
    const db = await this.open();

    try {
      const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
      const entries = transaction.objectStore(ENTRIES_STORE);

      for (const row of rows) {
        const existing = await indexedDbRequest(
          entries
            .index(BY_RECORD_INDEX)
            .count(
              IDBKeyRange.only([
                row.identityId,
                row.conversationId,
                row.recordId,
              ]),
            ),
        );

        if (existing === 0) entries.add(row);
      }

      await indexedDbTransaction(transaction);
    } finally {
      db.close();
    }
  }

  private async rowsFor(
    identityId: string,
    conversationId: string,
  ): Promise<DirectMessageHistoryRow[]> {
    const db = await this.open();

    try {
      const transaction = db.transaction(ENTRIES_STORE, 'readonly');
      const rows = await indexedDbRequest(
        transaction
          .objectStore(ENTRIES_STORE)
          .index(BY_SCOPE_INDEX)
          .getAll(IDBKeyRange.only([identityId, conversationId])) as IDBRequest<
          DirectMessageHistoryRow[]
        >,
      );

      await indexedDbTransaction(transaction);

      return rows;
    } finally {
      db.close();
    }
  }

  /** Rows across conversations, newest first, at most `limit`. */
  private async recentRows(
    identityId: string,
    limit: number,
  ): Promise<DirectMessageHistoryRow[]> {
    const db = await this.open();

    try {
      const transaction = db.transaction(ENTRIES_STORE, 'readonly');
      const rows: DirectMessageHistoryRow[] = [];

      await new Promise<void>((resolve, reject) => {
        const cursor = transaction
          .objectStore(ENTRIES_STORE)
          .openCursor(null, 'prev');

        cursor.addEventListener('success', () => {
          const current = cursor.result;

          if (current === null || rows.length >= limit) return resolve();

          const row = current.value as DirectMessageHistoryRow;

          if (row.identityId === identityId) rows.push(row);

          current.continue();
        });
        cursor.addEventListener('error', () => reject(cursor.error));
      });

      await indexedDbTransaction(transaction);

      return rows;
    } finally {
      db.close();
    }
  }

  private async verifiedKeys(session: Session): Promise<DeviceRootRowKeys> {
    const identityId = session.identity.id;
    const keys = DeviceRootRowKeys.derive(
      sessionRootKey(session),
      KEYS_LABEL,
      identityId,
    );
    const canary = await this.readCanary(identityId);

    if (canary && keys.opensCanary(canary)) return keys;

    const sealedCanary = keys.sealCanary();
    const db = await this.open();

    try {
      const transaction = db.transaction(
        [ENTRIES_STORE, CANARIES_STORE],
        'readwrite',
      );

      if ((await wipeIdentity(transaction, identityId)) > 0) {
        this.dropped.add(identityId);
      }
      transaction.objectStore(CANARIES_STORE).put(sealedCanary, identityId);
      await indexedDbTransaction(transaction);
    } finally {
      db.close();
    }

    return keys;
  }

  private async readCanary(
    identityId: string,
  ): Promise<Uint8Array | undefined> {
    const db = await this.open();

    try {
      const transaction = db.transaction(CANARIES_STORE, 'readonly');
      const canary = await indexedDbRequest(
        transaction.objectStore(CANARIES_STORE).get(identityId) as IDBRequest<
          Uint8Array | undefined
        >,
      );

      await indexedDbTransaction(transaction);

      return canary;
    } finally {
      db.close();
    }
  }

  private async open(): Promise<IDBDatabase> {
    const openRequest = indexedDB.open(this.databaseName, DATABASE_VERSION);

    openRequest.addEventListener('upgradeneeded', () => {
      const database = openRequest.result;
      const entries = database.createObjectStore(ENTRIES_STORE, {
        autoIncrement: true,
      });

      entries.createIndex(
        BY_RECORD_INDEX,
        ['identityId', 'conversationId', 'recordId'],
        { unique: true },
      );
      entries.createIndex(BY_SCOPE_INDEX, ['identityId', 'conversationId']);
      database.createObjectStore(CANARIES_STORE);
    });

    return indexedDbRequest(openRequest);
  }

  private openItems(
    keys: DeviceRootRowKeys,
    rows: DirectMessageHistoryRow[],
  ): DirectMessageHistoryItem[] {
    return rows.flatMap((row) => {
      const plaintext = keys.open(
        RECORD_PURPOSE,
        [row.conversationId, row.recordId],
        row.sealed,
      );

      return plaintext === undefined
        ? []
        : [{ conversationId: row.conversationId, plaintext }];
    });
  }

  /**
   * Every record of this identity across conversations, oldest first. Feeds
   * the backup file. Rejects with `DirectMessageHistoryStorageError` so a
   * failed read never passes for an empty history.
   */
  public async all(session: Session): Promise<DirectMessageHistoryItem[]> {
    try {
      const keys = await this.verifiedKeys(session);
      const rows = await this.recentRows(
        session.identity.id,
        Number.POSITIVE_INFINITY,
      );

      return this.openItems(keys, rows.reverse());
    } catch {
      throw new DirectMessageHistoryStorageError();
    }
  }

  /**
   * Stores the entries, deduped by record id. A failed write, such as an
   * exhausted browser quota, rejects with `DirectMessageHistoryStorageError`,
   * which carries no content.
   */
  public async append(
    session: Session,
    conversationId: string,
    entries: DirectMessageHistoryEntry[],
  ): Promise<void> {
    try {
      const keys = await this.verifiedKeys(session);

      if (entries.length === 0) return;

      const identityId = session.identity.id;
      const rows = entries.map((entry) => ({
        conversationId,
        identityId,
        recordId: entry.recordId,
        sealed: keys.seal(
          RECORD_PURPOSE,
          [conversationId, entry.recordId],
          entry.plaintext,
        ),
      }));

      await this.insert(rows);
    } catch {
      throw new DirectMessageHistoryStorageError();
    }
  }

  /**
   * Whether this device dropped the identity's stored history because it no
   * longer opens under the device-sealed root, as after a device revoke.
   * Reports each drop once. A deliberate `forget` is not a drop. Never throws.
   */
  public async checkDropped(session: Session): Promise<boolean> {
    try {
      await this.verifiedKeys(session);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Direct history check failed.');
    }

    return this.dropped.delete(session.identity.id);
  }

  public async forget(identityId: string): Promise<void> {
    this.dropped.delete(identityId);

    try {
      const db = await this.open();

      try {
        const transaction = db.transaction(
          [ENTRIES_STORE, CANARIES_STORE],
          'readwrite',
        );

        await wipeIdentity(transaction, identityId);
        await indexedDbTransaction(transaction);
      } finally {
        db.close();
      }
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Direct history forget failed.');
    }
  }

  public async load(
    session: Session,
    conversationId: string,
  ): Promise<Uint8Array[]> {
    try {
      const keys = await this.verifiedKeys(session);

      const rows = await this.rowsFor(session.identity.id, conversationId);

      return rows.flatMap((row) => {
        const plaintext = keys.open(
          RECORD_PURPOSE,
          [row.conversationId, row.recordId],
          row.sealed,
        );

        return plaintext === undefined ? [] : [plaintext];
      });
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Direct history load failed.');

      return [];
    }
  }

  /**
   * This identity's newest records across conversations, newest first, capped
   * at `limit`. Feeds the pairing export. Never throws: failures yield none.
   */
  public async recent(
    session: Session,
    limit: number,
  ): Promise<DirectMessageHistoryItem[]> {
    try {
      const keys = await this.verifiedKeys(session);

      return this.openItems(
        keys,
        await this.recentRows(session.identity.id, limit),
      );
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Direct history recent failed.');

      return [];
    }
  }
}
