import 'fake-indexeddb/auto';
import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceSealedCanaryRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedCanaryRecord';

import { DeviceSealedRowStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedRowStore';

type Row = { readonly id: string; readonly text: string };

const identityId = 'identity-1';
const replaced = 'Device sealed root was replaced.';

function root(fill: number): Buffer {
  return Buffer.alloc(32, fill);
}

function session(current: Buffer, previous?: Buffer): Session {
  return {
    deviceSealedRootKey: SymmetricKey.fromBuffer(current),
    identity: { id: identityId },
    previousDeviceSealedRootKey: previous
      ? SymmetricKey.fromBuffer(previous)
      : undefined,
  } as unknown as Session;
}

function row(id: string): Row {
  return { id, text: `text of ${id}` };
}

function store(name: string): DeviceSealedRowStore<Row> {
  return new DeviceSealedRowStore<Row>(name, 'pigeon-test-rows', 'Test rows');
}

function databaseName(): string {
  return `device-sealed-rows-${randomUUID()}`;
}

async function canaryRecord(
  name: string,
): Promise<DeviceSealedCanaryRecord | undefined> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const record = await new Promise<DeviceSealedCanaryRecord | undefined>(
    (resolve, reject) => {
      const request = database
        .transaction('canaries', 'readonly')
        .objectStore('canaries')
        .get(identityId) as IDBRequest<DeviceSealedCanaryRecord | undefined>;

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );

  database.close();

  return record;
}

/**
 * Holds the result of the next IndexedDB `get` until `release`, as when one
 * tab reads the canary and another tab writes before it acts on it.
 */
function pauseNextRead(): { release: () => void; started: Promise<void> } {
  const read = IDBObjectStore.prototype.get;
  let release = (): void => undefined;
  let start = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });

  jest
    .spyOn(IDBObjectStore.prototype, 'get')
    .mockImplementationOnce(function held(
      this: IDBObjectStore,
      query: IDBValidKey | IDBKeyRange,
    ) {
      const request = read.call(this, query);
      const listen = request.addEventListener.bind(request);

      request.addEventListener = ((
        type: string,
        listener: (event: Event) => void,
        options?: AddEventListenerOptions,
      ) =>
        listen(
          type,
          (event: Event) => void gate.then(() => listener(event)),
          options,
        )) as typeof request.addEventListener;
      start();

      return request;
    });

  return { release: () => release(), started };
}

describe(DeviceSealedRowStore.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a row another instance stored while this one first read the identity', async () => {
    const name = databaseName();
    const paused = pauseNextRead();
    const loading = store(name).load(session(root(5)));

    await paused.started;
    await store(name).save(session(root(5)), row('a'));
    paused.release();

    expect(await loading).toEqual([row('a')]);
    expect(await store(name).load(session(root(5)))).toEqual([row('a')]);
  });

  it('refuses a save that read the canary before another instance re-sealed it', async () => {
    const name = databaseName();

    await store(name).save(session(root(5)), row('a'));

    const paused = pauseNextRead();
    const saving = store(name).save(session(root(5)), row('stale'));

    await paused.started;
    await store(name).load(session(root(9), root(5)));
    paused.release();

    await expect(saving).rejects.toThrow(replaced);
    expect(await store(name).load(session(root(9)))).toEqual([row('a')]);
  });

  it('refuses the root a skipped rotation replaced and keeps the newer rows', async () => {
    const name = databaseName();

    await store(name).save(session(root(1)), row('a'));
    expect(await store(name).load(session(root(3), root(2)))).toEqual([]);
    await store(name).save(session(root(3), root(2)), row('b'));

    await expect(store(name).load(session(root(1)))).rejects.toThrow(replaced);
    await expect(store(name).load(session(root(2)))).rejects.toThrow(replaced);
    expect(await store(name).load(session(root(3)))).toEqual([row('b')]);
  });

  it('keeps the latest 16 replaced roots and still refuses the last one', async () => {
    const name = databaseName();

    await store(name).save(session(root(1)), row('a'));
    for (let fill = 2; fill <= 21; fill += 1) {
      await store(name).load(session(root(fill), root(fill - 1)));
    }

    expect((await canaryRecord(name))?.retired).toHaveLength(16);
    await expect(store(name).load(session(root(20)))).rejects.toThrow(replaced);
    await expect(store(name).load(session(root(5)))).rejects.toThrow(replaced);
    expect(await store(name).load(session(root(21)))).toEqual([row('a')]);
  });

  it('writes nothing when the replaced root is already listed', async () => {
    const name = databaseName();

    await store(name).save(session(root(5)), row('a'));
    await store(name).load(session(root(9), root(5)));

    const put = jest.spyOn(IDBObjectStore.prototype, 'put');
    const deleted = jest.spyOn(IDBObjectStore.prototype, 'delete');

    expect(await store(name).load(session(root(9), root(5)))).toEqual([
      row('a'),
    ]);
    expect(put).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
  });

  it('starts clean for a stale root once the identity is forgotten', async () => {
    const name = databaseName();

    await store(name).save(session(root(5)), row('a'));
    await store(name).load(session(root(9), root(5)));
    await store(name).forget(identityId);

    expect(await store(name).load(session(root(5)))).toEqual([]);
    await store(name).save(session(root(5)), row('b'));
    expect(await store(name).load(session(root(5)))).toEqual([row('b')]);
  });
});
