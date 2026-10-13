import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

/**
 * A one-to-one send that is not yet written to both inboxes. The record is the
 * built wire record, so a resume never uploads attachments again.
 */
export type DirectMessageOutboxRow = {
  conversationId: string;
  id: string;
  peerDelivered: boolean;
  peerIdentityId: string;
  record: DirectSentRecord;
  state: 'failed' | 'pending';
};

const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const CANARIES_STORE = 'canaries';
const IV_BYTES = 12;
const CANARY_PLAINTEXT = new TextEncoder().encode(
  'pigeon-direct-outbox:canary',
);
const HKDF_SALT = new TextEncoder().encode('pigeon-direct-outbox:salt');

type SealedValue = { sealed: Uint8Array<ArrayBuffer> };

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

function canaryAad(identityId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(['canary', identityId]));
}

async function deriveKey(
  root: Uint8Array,
  identityId: string,
): Promise<CryptoKey> {
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
      info: new TextEncoder().encode(`pigeon-direct-outbox:v1:${identityId}`),
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
  return new Promise<T>((resolve, reject) => {
    source.addEventListener(
      'success',
      () => {
        resolve(source.result);
      },
      { once: true },
    );
    source.addEventListener(
      'error',
      () => {
        reject(source.error);
      },
      { once: true },
    );
  });
}

function settle(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener(
      'complete',
      () => {
        resolve();
      },
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => {
        reject(transaction.error);
      },
      { once: true },
    );
    transaction.addEventListener(
      'abort',
      () => {
        reject(transaction.error);
      },
      { once: true },
    );
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  const opening = indexedDB.open(name, DATABASE_VERSION);

  opening.addEventListener('upgradeneeded', () => {
    opening.result.createObjectStore(ENTRIES_STORE);
    opening.result.createObjectStore(CANARIES_STORE);
  });

  return request(opening);
}

/** Drops every row of one identity and its canary, in one transaction. */
function wipeIdentity(transaction: IDBTransaction, identityId: string): void {
  transaction.objectStore(ENTRIES_STORE).delete(identityRange(identityId));
  transaction.objectStore(CANARIES_STORE).delete(identityId);
}

/**
 * The identity's key under this root. A canary sealed under the same key
 * detects a root change; on a mismatch or a missing canary the identity's rows
 * are dropped and the canary is re-sealed under the current root.
 */
async function verifiedKey(
  database: IDBDatabase,
  identityId: string,
  root: Uint8Array,
): Promise<CryptoKey> {
  const key = await deriveKey(root, identityId);
  const canary = await request<SealedValue | undefined>(
    database
      .transaction(CANARIES_STORE, 'readonly')
      .objectStore(CANARIES_STORE)
      .get(identityId),
  );

  if (canary && (await openSealed(key, canaryAad(identityId), canary.sealed))) {
    return key;
  }

  const sealedCanary = await seal(key, canaryAad(identityId), CANARY_PLAINTEXT);
  const transaction = database.transaction(
    [ENTRIES_STORE, CANARIES_STORE],
    'readwrite',
  );

  wipeIdentity(transaction, identityId);
  transaction
    .objectStore(CANARIES_STORE)
    .put({ sealed: sealedCanary }, identityId);
  await settle(transaction);

  return key;
}

/**
 * One-to-one sends that are not yet delivered to both inboxes. Each row is
 * sealed with AES-GCM under a key derived from the device-sealed root, so no
 * payload or peer id is readable at rest. Without a device-sealed root the
 * store keeps nothing; sends then live in memory only.
 */
export class DirectMessageOutboxStore {
  public constructor(
    private readonly databaseName: string = scopeClientStorageKey(
      'pigeon-direct-outbox',
    ),
  ) {}

  /** Persists a row before its first delivery attempt. Rejects on failure. */
  public async save(
    session: Session,
    row: DirectMessageOutboxRow,
  ): Promise<void> {
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return;

    const identityId = session.identity.id;

    try {
      const database = await openDatabase(this.databaseName);
      const key = await verifiedKey(database, identityId, root);
      const sealed = await seal(
        key,
        rowAad(identityId),
        new TextEncoder().encode(JSON.stringify(row)),
      );
      const transaction = database.transaction(ENTRIES_STORE, 'readwrite');

      transaction
        .objectStore(ENTRIES_STORE)
        .put({ sealed }, entryKey(identityId, row.id));
      await settle(transaction);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Direct outbox save failed.');

      throw error;
    }
  }

  /** Loads this identity's rows under the current root. Empty without one. */
  public async load(session: Session): Promise<DirectMessageOutboxRow[]> {
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return [];

    const identityId = session.identity.id;
    const database = await openDatabase(this.databaseName);
    const key = await verifiedKey(database, identityId, root);
    const sealedRows = await request<SealedValue[]>(
      database
        .transaction(ENTRIES_STORE, 'readonly')
        .objectStore(ENTRIES_STORE)
        .getAll(identityRange(identityId)),
    );
    const rows: DirectMessageOutboxRow[] = [];

    for (const { sealed } of sealedRows) {
      const plaintext = await openSealed(key, rowAad(identityId), sealed);

      if (plaintext) {
        rows.push(
          JSON.parse(
            new TextDecoder().decode(plaintext),
          ) as DirectMessageOutboxRow,
        );
      }
    }

    return rows;
  }

  /** Removes one row once both copies are written. Rejects on failure. */
  public async remove(identityId: string, id: string): Promise<void> {
    const database = await openDatabase(this.databaseName);
    const transaction = database.transaction(ENTRIES_STORE, 'readwrite');

    transaction.objectStore(ENTRIES_STORE).delete(entryKey(identityId, id));
    await settle(transaction);
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
      await settle(transaction);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Direct outbox forget failed.');
    }
  }
}
