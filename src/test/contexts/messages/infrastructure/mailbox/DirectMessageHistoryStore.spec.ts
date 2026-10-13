import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DirectMessageHistoryStorageError } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryStorageError';
import { DirectMessageHistoryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryStore';

const conversationId = 'conversation-1';
const marker = 'plaintext-marker-7f3a';
const storeNames = ['entries', 'canaries'];

function session(
  identityId: string,
  root: Buffer | null = Buffer.alloc(32, 5),
): Session {
  return {
    deviceSealedRootKey: root ? { getBuffer: () => root } : undefined,
    identity: { id: identityId },
  } as unknown as Session;
}

function entry(recordId: string): { plaintext: Uint8Array; recordId: string } {
  return { plaintext: Buffer.from(`${marker}:${recordId}`), recordId };
}

function texts(values: Uint8Array[]): string[] {
  return values.map((value) => Buffer.from(value).toString());
}

function databaseName(): string {
  return `direct-history-${randomUUID()}`;
}

function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowsOf(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowBytes(row: unknown): Buffer[] {
  return Object.values(row as Record<string, unknown>).flatMap((value) => {
    if (value instanceof Uint8Array) {
      return [Buffer.from(value.buffer, value.byteOffset, value.byteLength)];
    }

    return typeof value === 'string' ? [Buffer.from(value)] : [];
  });
}

async function storedChunks(name: string): Promise<Buffer[]> {
  const db = await openRaw(name);
  const rows = (
    await Promise.all(storeNames.map((storeName) => rowsOf(db, storeName)))
  ).flat();

  db.close();

  return rows.flatMap(rowBytes);
}

describe(DirectMessageHistoryStore.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replays appended records in arrival order across appends', async () => {
    const store = new DirectMessageHistoryStore(databaseName());

    await store.append(session('identity-1'), conversationId, [
      entry('a'),
      entry('b'),
    ]);
    await store.append(session('identity-1'), conversationId, [entry('c')]);

    expect(
      texts(await store.load(session('identity-1'), conversationId)),
    ).toEqual([`${marker}:a`, `${marker}:b`, `${marker}:c`]);
  });

  it('stores a record once when it is appended again', async () => {
    const store = new DirectMessageHistoryStore(databaseName());

    await store.append(session('identity-1'), conversationId, [entry('a')]);
    await store.append(session('identity-1'), conversationId, [
      entry('a'),
      entry('b'),
    ]);

    expect(
      texts(await store.load(session('identity-1'), conversationId)),
    ).toEqual([`${marker}:a`, `${marker}:b`]);
  });

  it('stores no plaintext in IndexedDB rows', async () => {
    const name = databaseName();
    const store = new DirectMessageHistoryStore(name);

    await store.append(session('identity-1'), conversationId, [entry('a')]);

    const chunks = await storedChunks(name);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((chunk) => chunk.includes(marker))).toBe(false);
  });

  it('drops history sealed under a previous device root', async () => {
    const name = databaseName();
    const store = new DirectMessageHistoryStore(name);
    const previousRoot = Buffer.alloc(32, 5);
    const rotatedRoot = Buffer.alloc(32, 9);

    await store.append(session('identity-1', previousRoot), conversationId, [
      entry('a'),
    ]);

    expect(
      await store.load(session('identity-1', rotatedRoot), conversationId),
    ).toEqual([]);
    expect(
      await store.load(session('identity-1', previousRoot), conversationId),
    ).toEqual([]);

    await store.append(session('identity-1', rotatedRoot), conversationId, [
      entry('b'),
    ]);

    expect(
      texts(
        await store.load(session('identity-1', rotatedRoot), conversationId),
      ),
    ).toEqual([`${marker}:b`]);
  });

  it('forgets one identity without touching another', async () => {
    const store = new DirectMessageHistoryStore(databaseName());

    await store.append(session('identity-1'), conversationId, [entry('a')]);
    await store.append(session('identity-2'), conversationId, [entry('b')]);

    await store.forget('identity-1');

    expect(await store.load(session('identity-1'), conversationId)).toEqual([]);
    expect(
      texts(await store.load(session('identity-2'), conversationId)),
    ).toEqual([`${marker}:b`]);
  });

  it('keeps history when the store is recreated after logout', async () => {
    const name = databaseName();

    await new DirectMessageHistoryStore(name).append(
      session('identity-1'),
      conversationId,
      [entry('a')],
    );

    expect(
      texts(
        await new DirectMessageHistoryStore(name).load(
          session('identity-1'),
          conversationId,
        ),
      ),
    ).toEqual([`${marker}:a`]);
  });

  it('does nothing without a device-sealed root', async () => {
    const name = databaseName();
    const store = new DirectMessageHistoryStore(name);

    await store.append(session('identity-1', null), conversationId, [
      entry('a'),
    ]);

    expect(
      await store.load(session('identity-1', null), conversationId),
    ).toEqual([]);
    expect(await storedChunks(name)).toEqual([]);
  });

  it('rejects with a storage error that carries no plaintext when storage fails', async () => {
    jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error(marker);
    });

    const store = new DirectMessageHistoryStore(databaseName());
    const appended = store.append(session('identity-1'), conversationId, [
      entry('a'),
    ]);

    await expect(appended).rejects.toBeInstanceOf(
      DirectMessageHistoryStorageError,
    );
    await expect(appended).rejects.not.toThrow(marker);
  });
});
