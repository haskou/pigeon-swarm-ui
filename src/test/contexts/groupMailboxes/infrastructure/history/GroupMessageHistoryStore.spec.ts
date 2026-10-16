import {
  CommitmentId,
  DeviceRootRowKeys,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { RawHistoryRow } from './RawHistoryRow';

import { GroupMessageHistoryStore } from '../../../../../contexts/groupMailboxes/infrastructure/history/GroupMessageHistoryStore';
import { DeviceSealedRootGeneration } from '../../../../../contexts/identities/domain/value-objects/DeviceSealedRootGeneration';
import { DirectMailboxRecords } from '../../../../../contexts/mailboxes/domain/DirectMailboxRecords';

const marker = 'group-history-marker-9a2b';
const replacedRoot = 'Device sealed root was replaced.';
const root = (fill: number): Buffer => Buffer.alloc(32, fill);
const session = (
  identityId: string,
  current: Buffer = root(5),
  previous?: Buffer,
  generation?: number,
): Session =>
  ({
    deviceSealedRootGeneration:
      generation === undefined
        ? undefined
        : DeviceSealedRootGeneration.fromNumber(generation),
    deviceSealedRootKey: SymmetricKey.fromBuffer(current),
    identity: { id: identityId },
    previousDeviceSealedRootKey: previous
      ? SymmetricKey.fromBuffer(previous)
      : undefined,
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

/** A message of `authorId`, with an id that author made. */
const from = (
  authorId: string,
  conversationId: string,
  createdAt: number,
  id: string = CommitmentId.groupMessage(authorId),
) =>
  DirectMailboxRecords.sent({
    authorId,
    conversationId,
    createdAt,
    encryptedPayload: `${marker}:${id}`,
    id,
    previousMessageIds: [],
  });

// The DOM lib of this project predates Promise.withResolvers.
const openRaw = (name: string, version?: number): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const rawRows = async (
  name: string,
  storeName: string,
): Promise<RawHistoryRow[]> => {
  const db = await openRaw(name);
  const store = db.transaction(storeName, 'readonly').objectStore(storeName);
  const rows = await new Promise<RawHistoryRow[]>((resolve, reject) => {
    const values = store.getAll();
    const keys = store.getAllKeys();

    keys.onsuccess = () =>
      resolve(
        keys.result.map((key, index) => ({
          key,
          value: values.result[index],
        })),
      );
    keys.onerror = () => reject(keys.error);
  });

  db.close();

  return rows;
};

/** Replaces every raw row of one store. */
const replaceRows = async (
  name: string,
  storeName: string,
  rows: RawHistoryRow[],
): Promise<void> => {
  const db = await openRaw(name);
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  store.clear();
  rows.forEach(({ key, value }) => store.put(value, key));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

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
    const decrypt = jest.spyOn(DeviceRootRowKeys.prototype, 'open');

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
    const decrypt = jest.spyOn(DeviceRootRowKeys.prototype, 'open');

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
    const decrypt = jest.spyOn(DeviceRootRowKeys.prototype, 'open');

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

  it('reports a root change that dropped the stored history until it is acknowledged', async () => {
    const name = `history-${randomUUID()}`;
    const rotated = session('alice', Buffer.alloc(32, 6));

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
    ]);
    const store = new GroupMessageHistoryStore(name);

    expect(await store.checkDropped(session('alice'))).toBe(false);
    expect(await store.checkDropped(rotated)).toBe(true);
    expect(await store.checkDropped(rotated)).toBe(true);
    store.acknowledgeDropped('alice');
    expect(await store.checkDropped(rotated)).toBe(false);
    expect(await store.load(rotated, 'c1', 5)).toEqual([]);
  });

  it('reports no drop when a root change finds nothing stored', async () => {
    const name = `history-${randomUUID()}`;

    await new GroupMessageHistoryStore(name).load(session('alice'), 'c1', 5);
    const store = new GroupMessageHistoryStore(name);

    expect(
      await store.checkDropped(session('alice', Buffer.alloc(32, 6))),
    ).toBe(false);
    expect(
      await new GroupMessageHistoryStore(
        `history-${randomUUID()}`,
      ).checkDropped(session('alice')),
    ).toBe(false);
  });

  it('reports neither a forget nor another identity’s drop', async () => {
    const name = `history-${randomUUID()}`;
    const rotated = (identityId: string) =>
      session(identityId, Buffer.alloc(32, 6));

    await new GroupMessageHistoryStore(name).append(session('alice'), [
      sent('c1', 'a', 1),
    ]);
    await new GroupMessageHistoryStore(name).append(session('bob'), [
      sent('c1', 'b', 1),
    ]);
    const store = new GroupMessageHistoryStore(name);

    await store.load(rotated('alice'), 'c1', 5);
    await store.forget('alice');

    expect(await store.checkDropped(rotated('alice'))).toBe(false);
    expect(await store.checkDropped(session('bob'))).toBe(false);
  });

  it('reports no drop without a device-sealed root or a readable database', async () => {
    const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

    expect(
      await store.checkDropped({
        identity: { id: 'alice' },
      } as unknown as Session),
    ).toBe(false);
    jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    expect(await store.checkDropped(session('alice'))).toBe(false);
  });

  it('re-seals the history and its counts under the root that replaced it, reporting no drop', async () => {
    const name = `history-${randomUUID()}`;
    const before = new GroupMessageHistoryStore(name);

    await before.append(session('bob'), [
      from('alice', 'c1', 1, 'a'),
      from('alice', 'c2', 2, 'b'),
    ]);
    await before.markRead(session('bob'), 'c1');
    await before.append(session('bob'), [from('alice', 'c1', 3, 'c')]);
    const revoked = session('bob', root(6), root(5));
    const store = new GroupMessageHistoryStore(name);

    expect(await store.checkDropped(revoked)).toBe(false);
    await store.append(revoked, [from('alice', 'c1', 1, 'a')]);
    expect(ids(await store.load(revoked, 'c1', 5))).toEqual(['a', 'c']);
    expect(ids(await store.load(revoked, 'c2', 5))).toEqual(['b']);
    expect(await store.activity(revoked, 'c1')).toEqual({
      latestMessageAt: 3,
      unreadCount: 1,
    });
    expect(await store.activity(revoked, 'c2')).toEqual({
      latestMessageAt: 2,
      unreadCount: 1,
    });
    expect(await rawRows(name, 'entries')).toHaveLength(3);
  });

  it('refuses a tab on the replaced root instead of wiping the re-sealed history', async () => {
    const name = `history-${randomUUID()}`;

    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    await new GroupMessageHistoryStore(name).append(session('bob'), [
      from('alice', 'c1', 1, 'a'),
    ]);
    await new GroupMessageHistoryStore(name).load(
      session('bob', root(6), root(5)),
      'c1',
      5,
    );
    const stale = new GroupMessageHistoryStore(name);

    await expect(stale.load(session('bob'), 'c1', 5)).rejects.toThrow(
      replacedRoot,
    );
    expect(await stale.checkDropped(session('bob'))).toBe(false);
    expect(
      ids(
        await new GroupMessageHistoryStore(name).load(
          session('bob', root(6)),
          'c1',
          5,
        ),
      ),
    ).toEqual(['a']);
  });

  it('stores nothing from a tab that held the replaced root while another re-sealed', async () => {
    const name = `history-${randomUUID()}`;
    const stale = new GroupMessageHistoryStore(name);

    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    await stale.append(session('bob'), [from('alice', 'c1', 1, 'a')]);
    await new GroupMessageHistoryStore(name).load(
      session('bob', root(6), root(5)),
      'c1',
      5,
    );

    await expect(
      stale.append(session('bob'), [from('alice', 'c1', 2, 'b')]),
    ).rejects.toThrow(replacedRoot);
    await expect(stale.markRead(session('bob'), 'c1')).rejects.toThrow(
      replacedRoot,
    );
    expect(await rawRows(name, 'entries')).toHaveLength(1);
    expect(
      ids(
        await new GroupMessageHistoryStore(name).load(
          session('bob', root(6)),
          'c1',
          5,
        ),
      ),
    ).toEqual(['a']);
  });

  it('drops and reports the history of a root a skipped rotation replaced', async () => {
    const name = `history-${randomUUID()}`;
    const skipped = session('bob', root(7), root(6));

    await new GroupMessageHistoryStore(name).append(session('bob'), [
      from('alice', 'c1', 1, 'a'),
    ]);
    const store = new GroupMessageHistoryStore(name);

    expect(await store.checkDropped(skipped)).toBe(true);
    expect(await store.load(skipped, 'c1', 5)).toEqual([]);
  });

  it('refuses a root published at a generation the stored one does not exceed, keeping the newer history', async () => {
    const name = `history-${randomUUID()}`;
    const newer = session('bob', root(6), undefined, 2);

    await new GroupMessageHistoryStore(name).append(newer, [
      from('alice', 'c1', 1, 'a'),
    ]);

    await expect(
      new GroupMessageHistoryStore(name).load(
        session('bob', root(5), undefined, 1),
        'c1',
        5,
      ),
    ).rejects.toThrow(replacedRoot);
    expect(
      ids(await new GroupMessageHistoryStore(name).load(newer, 'c1', 5)),
    ).toEqual(['a']);
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

  describe('unread', () => {
    it('counts the messages of other members, not its own', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

      await store.append(session('bob'), [
        from('alice', 'c1', 10),
        from('carol', 'c1', 20),
        from('bob', 'c1', 30),
      ]);
      await store.append(session('bob'), [from('alice', 'c2', 5)]);

      expect(await store.activity(session('bob'), 'c1')).toEqual({
        latestMessageAt: 30,
        unreadCount: 2,
      });
      expect(await store.activity(session('bob'), 'c2')).toEqual({
        latestMessageAt: 5,
        unreadCount: 1,
      });
      expect(await store.activity(session('bob'), 'c3')).toEqual({
        latestMessageAt: undefined,
        unreadCount: 0,
      });
    });

    it('clears the count once read, across restarts, and counts later arrivals', async () => {
      const name = `history-${randomUUID()}`;
      const store = new GroupMessageHistoryStore(name);

      await store.append(session('bob'), [
        from('alice', 'c1', 1),
        from('alice', 'c1', 2),
      ]);
      await store.markRead(session('bob'), 'c1');

      expect(await store.activity(session('bob'), 'c1')).toEqual({
        latestMessageAt: 2,
        unreadCount: 0,
      });
      const restarted = new GroupMessageHistoryStore(name);

      expect((await restarted.activity(session('bob'), 'c1')).unreadCount).toBe(
        0,
      );
      await restarted.append(session('bob'), [from('alice', 'c1', 3)]);

      expect(await restarted.activity(session('bob'), 'c1')).toEqual({
        latestMessageAt: 3,
        unreadCount: 1,
      });
    });

    it('counts a record stored twice once', async () => {
      const name = `history-${randomUUID()}`;
      const message = from('alice', 'c1', 1);

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        message,
        message,
      ]);
      await new GroupMessageHistoryStore(name).append(session('bob'), [
        message,
      ]);

      expect(
        (
          await new GroupMessageHistoryStore(name).activity(
            session('bob'),
            'c1',
          )
        ).unreadCount,
      ).toBe(1);
    });

    it('stops counting a message its author deleted, not one another member deleted', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);
      const kept = from('alice', 'c1', 1);
      const gone = from('alice', 'c1', 2);

      await store.append(session('bob'), [kept, gone]);
      await store.append(session('bob'), [
        DirectMailboxRecords.deleted({
          authorId: 'alice',
          conversationId: 'c1',
          targetMessageId: gone.id,
        }),
        DirectMailboxRecords.deleted({
          authorId: 'carol',
          conversationId: 'c1',
          targetMessageId: kept.id,
        }),
      ]);

      expect((await store.activity(session('bob'), 'c1')).unreadCount).toBe(1);
    });

    it('counts no edit or reaction as a new message', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);
      const message = from('alice', 'c1', 1);

      await store.append(session('bob'), [message]);
      await store.markRead(session('bob'), 'c1');
      await store.append(session('bob'), [
        DirectMailboxRecords.edited({
          authorId: 'alice',
          conversationId: 'c1',
          createdAt: 2,
          encryptedPayload: 'edit',
          id: CommitmentId.groupMessage('alice'),
          targetMessageId: message.id,
        }),
        DirectMailboxRecords.reaction({
          action: 'add',
          authorId: 'alice',
          conversationId: 'c1',
          createdAt: 3,
          emoji: '👍',
          targetMessageId: message.id,
        }),
      ]);

      expect(await store.activity(session('bob'), 'c1')).toEqual({
        latestMessageAt: 1,
        unreadCount: 0,
      });
    });

    it('takes history stored before any count as read, keeping its latest message time', async () => {
      const name = `history-${randomUUID()}`;

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        from('alice', 'c1', 10),
        from('alice', 'c1', 20),
      ]);
      await replaceRows(name, 'reads', []);
      const store = new GroupMessageHistoryStore(name);

      expect(await store.activity(session('bob'), 'c1')).toEqual({
        latestMessageAt: 20,
        unreadCount: 0,
      });
      await store.append(session('bob'), [from('alice', 'c1', 30)]);

      expect((await store.activity(session('bob'), 'c1')).unreadCount).toBe(1);
    });

    it('counts rows stored after the count was last written, as after a crash', async () => {
      const name = `history-${randomUUID()}`;

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        from('alice', 'c1', 1),
      ]);
      const before = await rawRows(name, 'reads');

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        from('alice', 'c1', 2),
      ]);
      await replaceRows(name, 'reads', before);

      expect(
        await new GroupMessageHistoryStore(name).activity(session('bob'), 'c1'),
      ).toEqual({ latestMessageAt: 2, unreadCount: 2 });
    });

    it('takes no latest message time from the future', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);
      const before = Date.now();

      await store.append(session('bob'), [
        from('alice', 'c1', before + 86_400_000),
      ]);
      const { latestMessageAt } = await store.activity(session('bob'), 'c1');

      expect(latestMessageAt).toBeGreaterThanOrEqual(before);
      expect(latestMessageAt).toBeLessThanOrEqual(Date.now());
    });

    it('counts every message past the ids it remembers', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);
      const messages = Array.from({ length: 250 }, (_, index) =>
        from('alice', 'c1', index),
      );

      await store.append(session('bob'), messages);

      expect((await store.activity(session('bob'), 'c1')).unreadCount).toBe(
        250,
      );
      await store.markRead(session('bob'), 'c1');

      expect((await store.activity(session('bob'), 'c1')).unreadCount).toBe(0);
    });

    it('counts a new arrival without opening the stored history', async () => {
      const name = `history-${randomUUID()}`;
      const writer = new GroupMessageHistoryStore(name);

      await writer.append(
        session('bob'),
        Array.from({ length: 10 }, (_, index) => from('alice', 'c1', index)),
      );
      await writer.markRead(session('bob'), 'c1');
      const store = new GroupMessageHistoryStore(name);
      const decrypt = jest.spyOn(DeviceRootRowKeys.prototype, 'open');

      await store.append(session('bob'), [from('alice', 'c1', 10)]);

      expect((await store.activity(session('bob'), 'c1')).unreadCount).toBe(1);
      expect(decrypt.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('writes nothing when marking a read conversation read again', async () => {
      const store = new GroupMessageHistoryStore(`history-${randomUUID()}`);

      await store.append(session('bob'), [from('alice', 'c1', 1)]);
      await store.markRead(session('bob'), 'c1');
      const encrypt = jest.spyOn(DeviceRootRowKeys.prototype, 'seal');

      await store.markRead(session('bob'), 'c1');

      expect(encrypt).not.toHaveBeenCalled();
    });

    it('drops the counts with the history when the device-sealed root changes', async () => {
      const name = `history-${randomUUID()}`;

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        from('alice', 'c1', 1),
      ]);

      expect(
        await new GroupMessageHistoryStore(name).activity(
          session('bob', Buffer.alloc(32, 6)),
          'c1',
        ),
      ).toEqual({ latestMessageAt: undefined, unreadCount: 0 });
    });

    it('forgets the counts of one identity only', async () => {
      const name = `history-${randomUUID()}`;
      const store = new GroupMessageHistoryStore(name);

      await store.append(session('bob'), [from('alice', 'c1', 1)]);
      await store.append(session('carol'), [from('alice', 'c1', 1)]);
      await store.forget('bob');

      expect(
        (await rawRows(name, 'reads')).map(({ key }) => (key as string[])[0]),
      ).toEqual(['carol']);
      expect((await store.activity(session('carol'), 'c1')).unreadCount).toBe(
        1,
      );
    });

    it('stores no plaintext of the count at rest', async () => {
      const name = `history-${randomUUID()}`;

      await new GroupMessageHistoryStore(name).append(session('bob'), [
        from('alice', `conversation-${marker}`, 1, `record-${marker}`),
      ]);

      expect(await rawRows(name, 'reads')).toHaveLength(1);
      expect(await storedText(name)).not.toContain(marker);
    });

    it.each([2, 3])(
      'keeps the history of a version %i database, its raw canary included',
      async (version) => {
        const source = `history-${randomUUID()}`;
        const target = `history-${randomUUID()}`;

        await new GroupMessageHistoryStore(source).append(session('bob'), [
          from('alice', 'c1', 1, 'a'),
        ]);
        const entries = await rawRows(source, 'entries');
        const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(target, version);

          request.onupgradeneeded = () => {
            const entryStore = request.result.createObjectStore('entries', {
              autoIncrement: true,
            });

            entryStore.createIndex(
              'byRecord',
              ['identityId', 'conversation', 'record'],
              { unique: true },
            );
            entryStore.createIndex('byConversation', [
              'identityId',
              'conversation',
            ]);
            request.result.createObjectStore('canaries');

            if (version > 2) request.result.createObjectStore('reads');
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        legacy.close();
        await replaceRows(target, 'entries', entries);
        await replaceRows(target, 'canaries', [
          {
            key: 'bob',
            value: DeviceRootRowKeys.derive(
              SymmetricKey.fromBuffer(root(5)),
              'pigeon-group-history',
              'bob',
            ).sealCanary(),
          },
        ]);
        const store = new GroupMessageHistoryStore(target);

        expect(ids(await store.load(session('bob'), 'c1', 5))).toEqual(['a']);
        expect(await store.activity(session('bob'), 'c1')).toEqual({
          latestMessageAt: 1,
          unreadCount: 0,
        });
        expect(
          ids(
            await new GroupMessageHistoryStore(target).load(
              session('bob', root(6), root(5)),
              'c1',
              5,
            ),
          ),
        ).toEqual(['a']);
      },
    );
  });
});
