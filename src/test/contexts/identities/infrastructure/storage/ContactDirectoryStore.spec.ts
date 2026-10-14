import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ContactDirectoryEntry } from '../../../../../contexts/identities/infrastructure/storage/ContactDirectoryEntry';

import { ContactDirectoryStore } from '../../../../../contexts/identities/infrastructure/storage/ContactDirectoryStore';

const contactId = 'contact-id-7c41';
const contactName = 'plaintext-name-5d0e';
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

function contact(
  identityId = contactId,
  name = contactName,
  seenAt = 1,
): ContactDirectoryEntry {
  return { identityId, name, seenAt };
}

function databaseName(): string {
  return `contact-directory-${randomUUID()}`;
}

function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeContents(
  db: IDBDatabase,
  storeName: string,
): Promise<{ keys: IDBValidKey[]; values: unknown[] }> {
  if (!db.objectStoreNames.contains(storeName)) {
    return Promise.resolve({ keys: [], values: [] });
  }

  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const keys = store.getAllKeys();
    const values = store.getAll();

    values.onsuccess = () =>
      resolve({ keys: keys.result, values: values.result });
    values.onerror = () => reject(values.error);
  });
}

function valueBytes(stored: unknown): Buffer[] {
  return Object.values(stored as Record<string, unknown>).flatMap((value) => {
    if (value instanceof Uint8Array) {
      return [Buffer.from(value.buffer, value.byteOffset, value.byteLength)];
    }

    return typeof value === 'string' ? [Buffer.from(value)] : [];
  });
}

async function storedChunks(name: string): Promise<Buffer[]> {
  const db = await openRaw(name);
  const contents = await Promise.all(
    storeNames.map((storeName) => storeContents(db, storeName)),
  );

  db.close();

  return contents.flatMap(({ keys, values }) => [
    ...keys.map((key) => Buffer.from(String(key))),
    ...values.flatMap(valueBytes),
  ]);
}

describe(ContactDirectoryStore.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replays the stored contacts after the store is recreated', async () => {
    const name = databaseName();

    await new ContactDirectoryStore(name).replace(session('identity-1'), [
      contact(),
    ]);

    expect(
      await new ContactDirectoryStore(name).contacts(session('identity-1')),
    ).toEqual([contact()]);
  });

  it('keeps neither contact names nor contact ids readable at rest', async () => {
    const name = databaseName();

    await new ContactDirectoryStore(name).replace(session('identity-1'), [
      contact(),
      contact('contact-id-2', 'second-name', 2),
    ]);

    const chunks = await storedChunks(name);

    expect(chunks.length).toBeGreaterThan(0);
    for (const secret of [
      contactId,
      contactName,
      'contact-id-2',
      'second-name',
    ]) {
      expect(chunks.some((chunk) => chunk.includes(secret))).toBe(false);
    }
  });

  it('replaces the stored contacts as a whole', async () => {
    const store = new ContactDirectoryStore(databaseName());

    await store.replace(session('identity-1'), [contact()]);
    await store.replace(session('identity-1'), [
      contact('contact-id-2', 'Grace', 2),
    ]);

    expect(await store.contacts(session('identity-1'))).toEqual([
      contact('contact-id-2', 'Grace', 2),
    ]);
  });

  it('drops contacts sealed under a previous device root', async () => {
    const name = databaseName();
    const previousRoot = Buffer.alloc(32, 5);
    const rotatedRoot = Buffer.alloc(32, 9);

    await new ContactDirectoryStore(name).replace(
      session('identity-1', previousRoot),
      [contact()],
    );

    expect(
      await new ContactDirectoryStore(name).contacts(
        session('identity-1', rotatedRoot),
      ),
    ).toEqual([]);
    expect(
      await new ContactDirectoryStore(name).contacts(
        session('identity-1', previousRoot),
      ),
    ).toEqual([]);
  });

  it('forgets one identity without touching another', async () => {
    const store = new ContactDirectoryStore(databaseName());

    await store.replace(session('identity-1'), [contact()]);
    await store.replace(session('identity-2'), [contact('contact-id-2')]);
    await store.forget('identity-1');

    expect(await store.contacts(session('identity-1'))).toEqual([]);
    expect(await store.contacts(session('identity-2'))).toEqual([
      contact('contact-id-2'),
    ]);
  });

  it('stores nothing without a device-sealed root', async () => {
    const name = databaseName();
    const store = new ContactDirectoryStore(name);

    await store.replace(session('identity-1', null), [contact()]);

    expect(await storedChunks(name)).toEqual([]);
    expect(await store.contacts(session('identity-1', null))).toEqual([]);
  });

  it('rejects and logs only a count when storage fails', async () => {
    jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error(contactName);
    });
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

    await expect(
      new ContactDirectoryStore(databaseName()).replace(session('identity-1'), [
        contact(),
      ]),
    ).rejects.toThrow(contactName);

    expect(debug).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(debug.mock.calls)).not.toContain(contactId);
  });
});
