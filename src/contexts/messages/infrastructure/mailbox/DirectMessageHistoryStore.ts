import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageHistoryEntry } from './DirectMessageHistoryEntry';
import type { DirectMessageHistoryRow } from './DirectMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const BY_RECORD_INDEX = 'byRecord';
const BY_SCOPE_INDEX = 'byScope';
const IV_BYTES = 12;
const CANARY_PLAINTEXT = new TextEncoder().encode(
  'pigeon-direct-history:canary',
);
const HKDF_SALT = new TextEncoder().encode('pigeon-direct-history:salt');

function recordAad(
  identityId: string,
  conversationId: string,
  recordId: string,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify(['record', identityId, conversationId, recordId]),
  );
}

function canaryAad(identityId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(['canary', identityId]));
}

async function deriveKey(root: Buffer, identityId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(root),
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      hash: 'SHA-256',
      info: new TextEncoder().encode(`pigeon-direct-history:v1:${identityId}`),
      name: 'HKDF',
      salt: HKDF_SALT,
    },
    material,
    { length: 256, name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(
  key: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  plaintext: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { additionalData: aad, iv, name: 'AES-GCM' },
      key,
      new Uint8Array(plaintext),
    ),
  );
  const sealed = new Uint8Array(IV_BYTES + ciphertext.byteLength);

  sealed.set(iv);
  sealed.set(ciphertext, IV_BYTES);

  return sealed;
}

async function openSealed(
  key: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  sealed: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          additionalData: aad,
          iv: sealed.subarray(0, IV_BYTES),
          name: 'AES-GCM',
        },
        key,
        sealed.subarray(IV_BYTES),
      ),
    );
  } catch {
    return undefined;
  }
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.addEventListener('success', () => resolve(source.result), {
      once: true,
    });
    source.addEventListener('error', () => reject(source.error), {
      once: true,
    });
  });
}

function settle(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), {
      once: true,
    });
    transaction.addEventListener('abort', () => reject(transaction.error), {
      once: true,
    });
  });
}

async function wipeIdentity(
  transaction: IDBTransaction,
  identityId: string,
): Promise<void> {
  const entries = transaction.objectStore(ENTRIES_STORE);
  const keys = await request(
    entries
      .index(BY_SCOPE_INDEX)
      .getAllKeys(IDBKeyRange.bound([identityId], [identityId, []])),
  );

  for (const key of keys) entries.delete(key);

  transaction.objectStore(CANARIES_STORE).delete(identityId);
}

/**
 * Decrypted direct-message records kept on this device so the timeline
 * survives logout and re-login. Each record is sealed with AES-GCM under a key
 * derived from the device-sealed root. A canary sealed under the same key
 * detects a root change; the identity's rows are then dropped, so rotating the
 * root drops the history.
 */
export class DirectMessageHistoryStore {
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
        const existing = await request(
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

      await settle(transaction);
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
      const rows = await request<DirectMessageHistoryRow[]>(
        transaction
          .objectStore(ENTRIES_STORE)
          .index(BY_SCOPE_INDEX)
          .getAll(IDBKeyRange.only([identityId, conversationId])) as IDBRequest<
          DirectMessageHistoryRow[]
        >,
      );

      await settle(transaction);

      return rows;
    } finally {
      db.close();
    }
  }

  private async verifiedKey(session: Session): Promise<CryptoKey | undefined> {
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return undefined;

    const identityId = session.identity.id;
    const key = await deriveKey(root, identityId);
    const canary = await this.readCanary(identityId);

    if (canary && (await openSealed(key, canaryAad(identityId), canary))) {
      return key;
    }

    const sealedCanary = await seal(
      key,
      canaryAad(identityId),
      CANARY_PLAINTEXT,
    );
    const db = await this.open();

    try {
      const transaction = db.transaction(
        [ENTRIES_STORE, CANARIES_STORE],
        'readwrite',
      );

      await wipeIdentity(transaction, identityId);
      transaction.objectStore(CANARIES_STORE).put(sealedCanary, identityId);
      await settle(transaction);
    } finally {
      db.close();
    }

    return key;
  }

  private async readCanary(
    identityId: string,
  ): Promise<Uint8Array<ArrayBuffer> | undefined> {
    const db = await this.open();

    try {
      const transaction = db.transaction(CANARIES_STORE, 'readonly');
      const canary = await request<Uint8Array<ArrayBuffer> | undefined>(
        transaction.objectStore(CANARIES_STORE).get(identityId) as IDBRequest<
          Uint8Array<ArrayBuffer> | undefined
        >,
      );

      await settle(transaction);

      return canary;
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
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
      openRequest.addEventListener('success', () =>
        resolve(openRequest.result),
      );
      openRequest.addEventListener('error', () => reject(openRequest.error));
    });
  }

  public async append(
    session: Session,
    conversationId: string,
    entries: DirectMessageHistoryEntry[],
  ): Promise<void> {
    try {
      const key = await this.verifiedKey(session);

      if (!key || entries.length === 0) return;

      const identityId = session.identity.id;
      const rows = await Promise.all(
        entries.map(async (entry) => ({
          conversationId,
          identityId,
          recordId: entry.recordId,
          sealed: await seal(
            key,
            recordAad(identityId, conversationId, entry.recordId),
            entry.plaintext,
          ),
        })),
      );

      await this.insert(rows);
    } catch {
      console.debug(
        `Direct history append failed for ${entries.length} record(s).`,
      );
    }
  }

  public async forget(identityId: string): Promise<void> {
    try {
      const db = await this.open();

      try {
        const transaction = db.transaction(
          [ENTRIES_STORE, CANARIES_STORE],
          'readwrite',
        );

        await wipeIdentity(transaction, identityId);
        await settle(transaction);
      } finally {
        db.close();
      }
    } catch {
      console.debug('Direct history forget failed.');
    }
  }

  public async load(
    session: Session,
    conversationId: string,
  ): Promise<Uint8Array[]> {
    try {
      const key = await this.verifiedKey(session);

      if (!key) return [];

      const rows = await this.rowsFor(session.identity.id, conversationId);
      const opened = await Promise.all(
        rows.map((row) =>
          openSealed(
            key,
            recordAad(row.identityId, row.conversationId, row.recordId),
            row.sealed,
          ),
        ),
      );

      return opened.filter(
        (plaintext): plaintext is Uint8Array => plaintext !== undefined,
      );
    } catch {
      console.debug('Direct history load failed.');

      return [];
    }
  }
}
