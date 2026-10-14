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

type EntryRow = { key: IDBValidKey; value: { sealed: Uint8Array } };

/** Runs `change` over the raw history rows, then writes them back. */
const rewriteEntries = async (
  name: string,
  change: (rows: EntryRow[]) => EntryRow[],
): Promise<number> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const store = db.transaction('entries', 'readwrite').objectStore('entries');
  const rows = await new Promise<EntryRow[]>((resolve, reject) => {
    const values = store.getAll();
    const keys = store.getAllKeys();

    keys.onsuccess = () =>
      resolve(
        keys.result.map((key, index) => ({
          key,
          value: values.result[index] as EntryRow['value'],
        })),
      );
    keys.onerror = () => reject(keys.error);
  });

  await Promise.all(
    change(rows).map(
      ({ key, value }) =>
        new Promise<void>((resolve, reject) => {
          const request = store.put(value, key);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
  db.close();

  return rows.length;
};

const ids = (records: { id: string }[]): string[] =>
  records.map(({ id }) => id);

describe(GroupMessageHistoryStore.name, () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads the latest arrivals of one conversation, once each, oldest first', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [
      sent('c1', 'b', 2),
      sent('c1', 'a', 1),
    ]);
    await store.append(session('alice'), [sent('c2', 'x', 3)]);
    await store.append(session('alice'), [sent('c1', 'a', 1)]);
    await store.append(session('alice'), [sent('c1', 'c', 4)]);

    expect(ids(await store.load(session('alice'), 'c1', 10))).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(ids(await store.load(session('alice'), 'c1', 2))).toEqual([
      'a',
      'c',
    ]);
  });

  it('opens only the rows of the requested page, once', async () => {
    const name = `history-${randomUUID()}`;
    const writer = new GroupMessageHistoryStore(name);

    for (let index = 0; index < 10; index += 1) {
      await writer.append(session('alice'), [
        sent('c1', `m${index}`, index),
        sent('c2', `n${index}`, index),
      ]);
    }
    const store = new GroupMessageHistoryStore(name);
    const decrypt = jest.spyOn(crypto.subtle, 'decrypt');

    expect(ids(await store.load(session('alice'), 'c1', 3))).toEqual([
      'm7',
      'm8',
      'm9',
    ]);
    const firstPage = decrypt.mock.calls.length;

    expect(firstPage).toBeLessThanOrEqual(4);
    expect(ids(await store.load(session('alice'), 'c1', 3))).toHaveLength(3);
    expect(decrypt.mock.calls.length).toBe(firstPage);
    expect(ids(await store.load(session('alice'), 'c1', 5))).toEqual([
      'm5',
      'm6',
      'm7',
      'm8',
      'm9',
    ]);
    expect(decrypt.mock.calls.length).toBe(firstPage + 2);
  });

  it('serves records appended after a load without opening them', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [sent('c1', 'a', 1)]);
    await store.load(session('alice'), 'c1', 5);
    await store.append(session('alice'), [sent('c1', 'b', 2)]);
    const decrypt = jest.spyOn(crypto.subtle, 'decrypt');

    expect(ids(await store.load(session('alice'), 'c1', 5))).toEqual([
      'a',
      'b',
    ]);
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('pages once each record appended after a lone author lookup', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [sent('c1', 'a', 1)]);
    await store.author(session('alice'), 'c1', 'a');
    await store.append(session('alice'), [sent('c1', 'b', 2)]);

    expect(ids(await store.load(session('alice'), 'c1', 5))).toEqual([
      'a',
      'b',
    ]);
  });

  it('finds the author of one stored message by opening that row only', async () => {
    const name = `history-${randomUUID()}`;
    const writer = new GroupMessageHistoryStore(name);

    for (let index = 0; index < 10; index += 1) {
      await writer.append(session('alice'), [sent('c1', `m${index}`, index)]);
    }
    const store = new GroupMessageHistoryStore(name);
    const decrypt = jest.spyOn(crypto.subtle, 'decrypt');

    expect(await store.author(session('alice'), 'c1', 'm4')).toBe('alice');
    expect(decrypt.mock.calls.length).toBeLessThanOrEqual(2);
    expect(await store.author(session('alice'), 'c2', 'm4')).toBeUndefined();
    expect(await store.author(session('alice'), 'c1', 'nope')).toBeUndefined();
  });

  it('drops the history when the device-sealed root changes', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
    ]);

    expect(
      await new GroupMessageHistoryStore(name).load(
        session('alice', Buffer.alloc(32, 6)),
        'c1',
        5,
      ),
    ).toEqual([]);
  });

  it('stores no plaintext at rest, not even the conversation or record id', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent(`conversation-${marker}`, `record-${marker}`, 1),
    ]);

    const text = await storedText(name);

    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('alice');
    expect(text).not.toContain(marker);
  });

  it('opens no row whose sealed record was moved into another row', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
      sent('c1', 'b', 2),
    ]);
    await rewriteEntries(name, ([first, second]) => [
      {
        key: first.key,
        value: { ...first.value, sealed: second.value.sealed },
      },
      {
        key: second.key,
        value: { ...second.value, sealed: first.value.sealed },
      },
    ]);
    const store = new GroupMessageHistoryStore(name);

    expect(await store.load(session('alice'), 'c1', 5)).toEqual([]);
    expect(await store.author(session('alice'), 'c1', 'a')).toBeUndefined();
  });

  it('keeps one row per record when it is stored again after a restart', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
    ]);
    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
      sent('c1', 'a', 1),
    ]);

    expect(await rewriteEntries(name, () => [])).toBe(1);
    expect(
      ids(
        await new GroupMessageHistoryStore(name).load(
          session('alice'),
          'c1',
          5,
        ),
      ),
    ).toEqual(['a']);
  });

  it('forgets one identity without touching another', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    await store.append(session('alice'), [sent('c1', 'a', 1)]);
    await store.append(session('bob'), [sent('c1', 'b', 1)]);
    await store.load(session('alice'), 'c1', 5);
    await store.forget('alice');

    expect(await store.load(session('alice'), 'c1', 5)).toEqual([]);
    expect(await store.load(session('bob'), 'c1', 5)).toHaveLength(1);
  });
});
