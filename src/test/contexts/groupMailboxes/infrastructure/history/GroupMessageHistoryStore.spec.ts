import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { GroupMessageHistoryStore } from '../../../../../contexts/groupMailboxes/infrastructure/history/GroupMessageHistoryStore';
import { DirectMailboxRecords } from '../../../../../contexts/mailboxes/domain/DirectMailboxRecords';

const marker = 'group-history-marker-9a2b';
const session = (
  identityId: string,
  root: Buffer = Buffer.alloc(32, 5),
): Session =>
  ({
    deviceSealedRootKey: { getBuffer: () => root },
    identity: { id: identityId },
  }) as unknown as Session;
const sent = (conversationId: string, id: string, createdAt: number) =>
  DirectMailboxRecords.sent({
    authorId: 'alice',
    conversationId,
    createdAt,
    encryptedPayload: `${marker}:${id}`,
    id,
    previousMessageIds: [],
  });

const storedText = async (name: string): Promise<string> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const rows = await Promise.all(
    [...db.objectStoreNames].map(
      (storeName) =>
        new Promise<unknown[]>((resolve, reject) => {
          const store = db
            .transaction(storeName, 'readonly')
            .objectStore(storeName);
          const values = store.getAll();
          const keys = store.getAllKeys();

          keys.onsuccess = () => resolve([...values.result, ...keys.result]);
          keys.onerror = () => reject(keys.error);
        }),
    ),
  );

  db.close();

  return rows
    .flat()
    .flatMap((row) =>
      typeof row === 'object' && row !== null
        ? Object.values(row as Record<string, unknown>)
        : [row],
    )
    .map((value) =>
      value instanceof Uint8Array
        ? Buffer.from(value).toString('latin1')
        : String(value),
    )
    .join('|');
};

describe(GroupMessageHistoryStore.name, () => {
  it('loads one conversation oldest first, once per record', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [
      sent('c1', 'b', 2),
      sent('c1', 'a', 1),
    ]);
    await store.append(session('alice'), [sent('c2', 'a', 3)]);
    await store.append(session('alice'), [sent('c1', 'a', 1)]);

    expect(
      (await store.load(session('alice'), 'c1')).map(({ id }) => id),
    ).toEqual(['a', 'b']);
  });

  it('stores no plaintext at rest', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent(`conversation-${marker}`, `record-${marker}`, 1),
    ]);

    const text = await storedText(name);

    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('alice');
    expect(text).not.toContain(marker);
  });

  it('forgets one identity without touching another', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [sent('c1', 'a', 1)]);
    await store.append(session('bob'), [sent('c1', 'b', 1)]);
    await store.forget('alice');

    expect(await store.load(session('alice'), 'c1')).toEqual([]);
    expect(await store.load(session('bob'), 'c1')).toHaveLength(1);
  });
});
