import 'fake-indexeddb/auto';
import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageOutboxRow } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxRow';

import { DirectMessageOutboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxStore';

const conversationId = 'conversation-1';
const marker = 'plaintext-marker-5d0e';
const storeNames = ['entries', 'canaries'];

function session(
  identityId: string,
  root: Buffer | null = Buffer.alloc(32, 5),
  previousRoot?: Buffer,
): Session {
  return {
    deviceSealedRootKey: root ? SymmetricKey.fromBuffer(root) : undefined,
    identity: { id: identityId },
    previousDeviceSealedRootKey: previousRoot
      ? SymmetricKey.fromBuffer(previousRoot)
      : undefined,
  } as unknown as Session;
}

function row(
  id: string,
  peerIdentityId = 'identity-2',
): DirectMessageOutboxRow {
  return {
    conversationId,
    id,
    peerDelivered: false,
    peerIdentityId,
    record: {
      authorId: 'identity-1',
      conversationId,
      createdAt: 1,
      encryptedPayload: `${marker}:${id}`,
      id,
      previousMessageIds: [],
      type: 'sent',
    } as unknown as DirectMessageOutboxRow['record'],
    state: 'pending',
  };
}

function databaseName(): string {
  return `direct-outbox-${randomUUID()}`;
}

function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowsOf(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);

  return new Promise<unknown[]>((resolve, reject) => {
    const request = db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowBytes(stored: unknown): Buffer[] {
  return Object.values(stored as Record<string, unknown>).flatMap((value) => {
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

describe(DirectMessageOutboxStore.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replays saved rows after the store is recreated', async () => {
    const name = databaseName();

    await new DirectMessageOutboxStore(name).save(
      session('identity-1'),
      row('a'),
    );

    expect(
      await new DirectMessageOutboxStore(name).load(session('identity-1')),
    ).toEqual([row('a')]);
  });

  it('stores no plaintext in IndexedDB rows', async () => {
    const name = databaseName();

    await new DirectMessageOutboxStore(name).save(
      session('identity-1'),
      row('a'),
    );

    const chunks = await storedChunks(name);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((chunk) => chunk.includes(marker))).toBe(false);
  });

  it('updates a row in place when it is saved again', async () => {
    const store = new DirectMessageOutboxStore(databaseName());
    const delivered = { ...row('a'), peerDelivered: true };

    await store.save(session('identity-1'), row('a'));
    await store.save(session('identity-1'), delivered);

    expect(await store.load(session('identity-1'))).toEqual([delivered]);
  });

  it('removes one row and keeps its siblings', async () => {
    const store = new DirectMessageOutboxStore(databaseName());

    await store.save(session('identity-1'), row('a'));
    await store.save(session('identity-1'), row('b'));
    await store.remove('identity-1', 'a');

    expect(await store.load(session('identity-1'))).toEqual([row('b')]);
  });

  it('keeps the rows across a root rotation, re-sealed under the new root', async () => {
    const name = databaseName();
    const previousRoot = Buffer.alloc(32, 5);
    const rotatedRoot = Buffer.alloc(32, 9);

    await new DirectMessageOutboxStore(name).save(
      session('identity-1', previousRoot),
      row('a'),
    );

    expect(
      await new DirectMessageOutboxStore(name).load(
        session('identity-1', rotatedRoot, previousRoot),
      ),
    ).toEqual([row('a')]);
    expect(
      await new DirectMessageOutboxStore(name).load(
        session('identity-1', rotatedRoot),
      ),
    ).toEqual([row('a')]);
    expect(
      (await storedChunks(name)).some((chunk) => chunk.includes(marker)),
    ).toBe(false);
  });

  it('refuses the root it re-sealed away from and keeps the rows', async () => {
    const store = new DirectMessageOutboxStore(databaseName());
    const previousRoot = Buffer.alloc(32, 5);
    const rotatedRoot = Buffer.alloc(32, 9);

    await store.save(session('identity-1', previousRoot), row('a'));
    await store.load(session('identity-1', rotatedRoot, previousRoot));

    await expect(
      store.save(session('identity-1', previousRoot), row('b')),
    ).rejects.toThrow();
    await expect(
      store.load(session('identity-1', previousRoot)),
    ).rejects.toThrow();
    expect(await store.load(session('identity-1', rotatedRoot))).toEqual([
      row('a'),
    ]);
  });

  it('drops rows sealed under a root the session neither holds nor replaced', async () => {
    const name = databaseName();
    const previousRoot = Buffer.alloc(32, 5);
    const rotatedRoot = Buffer.alloc(32, 9);

    await new DirectMessageOutboxStore(name).save(
      session('identity-1', previousRoot),
      row('a'),
    );

    expect(
      await new DirectMessageOutboxStore(name).load(
        session('identity-1', rotatedRoot),
      ),
    ).toEqual([]);
    expect(
      await new DirectMessageOutboxStore(name).load(
        session('identity-1', previousRoot),
      ),
    ).toEqual([]);
  });

  it('forgets one identity without touching another', async () => {
    const store = new DirectMessageOutboxStore(databaseName());

    await store.save(session('identity-1'), row('a'));
    await store.save(session('identity-2'), row('b'));
    await store.forget('identity-1');

    expect(await store.load(session('identity-1'))).toEqual([]);
    expect(await store.load(session('identity-2'))).toEqual([row('b')]);
  });

  it('stores nothing without a device-sealed root', async () => {
    const name = databaseName();
    const store = new DirectMessageOutboxStore(name);

    await store.save(session('identity-1', null), row('a'));

    expect(await storedChunks(name)).toEqual([]);
    expect(await store.load(session('identity-1', null))).toEqual([]);
  });

  it('rejects and logs only a count when storage fails', async () => {
    jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error(marker);
    });
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const store = new DirectMessageOutboxStore(databaseName());

    await expect(store.save(session('identity-1'), row('a'))).rejects.toThrow(
      marker,
    );

    expect(debug).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(debug.mock.calls)).not.toContain(marker);
  });
});
