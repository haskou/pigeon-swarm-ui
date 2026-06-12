import type { Session } from '../../../../shared/domain/pigeonResources.types';

type LocalDeviceUnlockKeyPair = {
  privateKey: string;
  publicKey: string;
};

export type LocalDeviceUnlockPayload = {
  keyPair: LocalDeviceUnlockKeyPair;
  masterKey: string;
  version: 1;
};

type LocalDeviceUnlockRecord = {
  createdAt: number;
  deviceKey: CryptoKey;
  encryptedPayload: ArrayBuffer;
  identityId: string;
  identityVersion: number;
  iv: ArrayBuffer;
  keychainVersion: number;
  updatedAt: number;
};

const DB_NAME = 'pigeon-swarm-device-unlock';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;
const PAYLOAD_VERSION = 1;
const AES_GCM_IV_BYTES = 12;

function getLocalDeviceUnlockRecord(
  store: IDBObjectStore,
  identityId: string,
): IDBRequest<LocalDeviceUnlockRecord | undefined> {
  return store.get(identityId) as IDBRequest<
    LocalDeviceUnlockRecord | undefined
  >;
}

export async function clearLocalDeviceUnlock(
  identityId?: string,
): Promise<void> {
  const database = await openDeviceUnlockDatabase();

  if (!database) return;

  await runStoreRequest(database, 'readwrite', (store) =>
    identityId ? store.delete(identityId) : store.clear(),
  );
  database.close();
}

export async function loadLocalDeviceUnlock(
  identityId: string,
): Promise<LocalDeviceUnlockPayload | null> {
  const database = await openDeviceUnlockDatabase();

  if (!database) return null;

  const record = await runStoreRequest<LocalDeviceUnlockRecord | undefined>(
    database,
    'readonly',
    (store) => getLocalDeviceUnlockRecord(store, identityId),
  );

  database.close();

  if (!record) return null;

  try {
    const decrypted = await crypto.subtle.decrypt(
      { iv: record.iv, name: 'AES-GCM' },
      record.deviceKey,
      record.encryptedPayload,
    );
    const payload = JSON.parse(
      new TextDecoder().decode(decrypted),
    ) as Partial<LocalDeviceUnlockPayload>;

    if (
      payload.version !== PAYLOAD_VERSION ||
      !payload.masterKey ||
      !payload.keyPair?.privateKey ||
      !payload.keyPair.publicKey
    ) {
      return null;
    }

    return {
      keyPair: {
        privateKey: payload.keyPair.privateKey,
        publicKey: payload.keyPair.publicKey,
      },
      masterKey: payload.masterKey,
      version: PAYLOAD_VERSION,
    };
  } catch {
    await clearLocalDeviceUnlock(identityId);

    return null;
  }
}

export async function saveLocalDeviceUnlock(session: Session): Promise<void> {
  const database = await openDeviceUnlockDatabase();

  if (!database) return;

  const existing = await runStoreRequest<LocalDeviceUnlockRecord | undefined>(
    database,
    'readonly',
    (store) => getLocalDeviceUnlockRecord(store, session.identity.id),
  );
  const now = Date.now();
  const deviceKey = await crypto.subtle.generateKey(
    { length: 256, name: 'AES-GCM' },
    false,
    ['decrypt', 'encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const payload: LocalDeviceUnlockPayload = {
    keyPair: session.keyPair.toPrimitives(),
    masterKey: session.masterKey.valueOf(),
    version: PAYLOAD_VERSION,
  };
  const encryptedPayload = await crypto.subtle.encrypt(
    { iv, name: 'AES-GCM' },
    deviceKey,
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  await runStoreRequest(database, 'readwrite', (store) =>
    store.put({
      createdAt: existing?.createdAt ?? now,
      deviceKey,
      encryptedPayload,
      identityId: session.identity.id,
      identityVersion: session.identity.version,
      iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength),
      keychainVersion: session.keychain.version,
      updatedAt: now,
    } satisfies LocalDeviceUnlockRecord),
  );
  database.close();
}

function openDeviceUnlockDatabase(): Promise<IDBDatabase | null> {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener('error', () => resolve(null));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'identityId' });
      }
    });
  });
}

function runStoreRequest<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = callback(transaction.objectStore(STORE_NAME));

    request.addEventListener('error', () => reject(request.error));
    request.addEventListener('success', () => resolve(request.result));
    transaction.addEventListener('error', () => reject(transaction.error));
  });
}
