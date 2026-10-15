import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { DeviceSealedEntryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';
import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../../shared/infrastructure/storage/indexedDbRequest';

const LABEL = 'pigeon-mls-state';
const GROUP_ID = 'group-id-marker-41c7';
const CIPHERTEXT_ID = 'ciphertext-id-marker-0d2e';
const KEY_PACKAGE_ID = 'key-package-id-marker-77ab';
const PLAINTEXT = 'plaintext-marker-5f19';
const GROUP_STATE = new TextEncoder().encode('group-state-marker-c3d8');
const HPKE_PRIVATE_KEY = new TextEncoder().encode('hpke-private-marker-a1e0');

type RawRow = { key: IDBValidKey; value: Uint8Array };

const root = (fill: number) => ({ getBuffer: () => Buffer.alloc(32, fill) });

const session = (
  identityId: string,
  current: number | undefined,
  previous?: number,
): Session =>
  ({
    deviceId: 'device-1',
    deviceSealedRootKey: current === undefined ? undefined : root(current),
    identity: { id: identityId },
    previousDeviceSealedRootKey:
      previous === undefined ? undefined : root(previous),
  }) as unknown as Session;

const opened = (name: string, current: () => Session) => {
  const entries = new DeviceSealedEntryStore(name, LABEL);

  return { entries, store: new IndexedDbMlsStateStore(entries, current) };
};

const stateStore = (name: string, current: Session) =>
  opened(name, () => current).store;

const keyPackage = () => ({
  groupId: GROUP_ID,
  id: KEY_PACKAGE_ID,
  privatePackage: {
    hpkePrivateKey: HPKE_PRIVATE_KEY,
    initPrivateKey: new Uint8Array([1, 2, 3]),
    signaturePrivateKey: new Uint8Array([4, 5, 6]),
  },
  publicBytes: new Uint8Array([7, 8, 9]),
});

const fill = async (store: IndexedDbMlsStateStore): Promise<void> => {
  await store.saveGroup(GROUP_ID, GROUP_STATE);
  await store.saveKeyPackage(keyPackage());
  await store.savePlaintext(GROUP_ID, CIPHERTEXT_ID, PLAINTEXT);
};

const expectFilled = async (store: IndexedDbMlsStateStore): Promise<void> => {
  expect(await store.loadGroup(GROUP_ID)).toEqual(GROUP_STATE);
  expect(await store.loadKeyPackages()).toEqual([keyPackage()]);
  expect(await store.loadPlaintext(GROUP_ID, CIPHERTEXT_ID)).toBe(PLAINTEXT);
};

const expectEmpty = async (store: IndexedDbMlsStateStore): Promise<void> => {
  expect(await store.loadGroup(GROUP_ID)).toBeUndefined();
  expect(await store.loadKeyPackages()).toEqual([]);
  expect(await store.loadPlaintext(GROUP_ID, CIPHERTEXT_ID)).toBeUndefined();
};

const rawDatabase = (name: string): Promise<IDBDatabase> =>
  indexedDbRequest(indexedDB.open(name));

const rawRows = async (
  name: string,
  table: 'canaries' | 'entries' = 'entries',
): Promise<RawRow[]> => {
  const database = await rawDatabase(name);

  try {
    const rows = database.transaction(table, 'readonly').objectStore(table);
    const [keys, values] = await Promise.all([
      indexedDbRequest(rows.getAllKeys()),
      indexedDbRequest<Uint8Array[]>(rows.getAll()),
    ]);

    return keys.map((key, index) => ({
      key,
      value: new Uint8Array(values[index]),
    }));
  } finally {
    database.close();
  }
};

const writeRaw = async (name: string, rows: RawRow[]): Promise<void> => {
  const database = await rawDatabase(name);

  try {
    const transaction = database.transaction('entries', 'readwrite');

    for (const { key, value } of rows) {
      transaction.objectStore('entries').put(value, key);
    }
    await indexedDbTransaction(transaction);
  } finally {
    database.close();
  }
};

describe('IndexedDbMlsStateStore', () => {
  let name: string;

  beforeEach(() => {
    name = `mls-state-${randomUUID()}`;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps group state, key packages and plaintexts across reopening', async () => {
    await fill(stateStore(name, session('alice', 1)));

    await expectFilled(stateStore(name, session('alice', 1)));
  });

  it('deletes a key package', async () => {
    const store = stateStore(name, session('alice', 1));

    await fill(store);
    await store.deleteKeyPackage(KEY_PACKAGE_ID);

    expect(
      await stateStore(name, session('alice', 1)).loadKeyPackages(),
    ).toEqual([]);
  });

  it('names no group for a key package stored before packages named theirs', async () => {
    const current = session('alice', 1);
    const { entries, store } = opened(name, () => current);

    await entries.put(
      current,
      'key-package',
      KEY_PACKAGE_ID,
      new TextEncoder().encode(
        JSON.stringify({
          hpkePrivateKey: encodeBase64Url(HPKE_PRIVATE_KEY),
          initPrivateKey: encodeBase64Url(new Uint8Array([1, 2, 3])),
          publicBytes: encodeBase64Url(new Uint8Array([7, 8, 9])),
          signaturePrivateKey: encodeBase64Url(new Uint8Array([4, 5, 6])),
        }),
      ),
    );

    expect(await store.loadKeyPackages()).toEqual([
      { ...keyPackage(), groupId: undefined },
    ]);
  });

  it('keeps each identity apart', async () => {
    await fill(stateStore(name, session('alice', 1)));

    await expectEmpty(stateStore(name, session('bob', 1)));
    await expectFilled(stateStore(name, session('alice', 1)));
  });

  it('stores no secret, plaintext or id in the clear', async () => {
    await fill(stateStore(name, session('alice', 1)));

    const rows = [
      ...(await rawRows(name)),
      ...(await rawRows(name, 'canaries')),
    ];
    const keys = JSON.stringify(rows.map(({ key }) => key));
    const values = rows
      .map(({ value }) => Buffer.from(value).toString('latin1'))
      .join('\n');
    const markers = [
      GROUP_ID,
      CIPHERTEXT_ID,
      KEY_PACKAGE_ID,
      PLAINTEXT,
      new TextDecoder().decode(GROUP_STATE),
      new TextDecoder().decode(HPKE_PRIVATE_KEY),
      encodeBase64Url(HPKE_PRIVATE_KEY),
      encodeBase64Url(GROUP_STATE),
    ];

    expect(rows.length).toBeGreaterThan(3);
    for (const marker of markers) {
      expect(keys).not.toContain(marker);
      expect(values).not.toContain(marker);
    }
  });

  it('does not open a value moved to another entry', async () => {
    const store = stateStore(name, session('alice', 1));

    await store.savePlaintext(GROUP_ID, 'first', 'first plaintext');
    await store.savePlaintext(GROUP_ID, 'second', 'second plaintext');

    const [first, second] = await rawRows(name);

    await writeRaw(name, [
      { key: first.key, value: second.value },
      { key: second.key, value: first.value },
    ]);

    const reopened = stateStore(name, session('alice', 1));

    expect(await reopened.loadPlaintext(GROUP_ID, 'first')).toBeUndefined();
    expect(await reopened.loadPlaintext(GROUP_ID, 'second')).toBeUndefined();
  });

  it('re-seals every entry under the root that replaced the one it was sealed under', async () => {
    await fill(stateStore(name, session('alice', 1)));
    const before = await rawRows(name);

    await expectFilled(stateStore(name, session('alice', 2, 1)));

    const after = await rawRows(name);

    expect(after).toHaveLength(before.length);
    for (const row of after) {
      expect(before).not.toContainEqual(row);
    }
    await expectFilled(stateStore(name, session('alice', 2)));
  });

  it('keeps the groups when the session follows a revoke of another device in place', async () => {
    let current = session('alice', 1);
    const store = opened(name, () => current).store;

    await fill(store);
    current = session('alice', 2, 1);

    await expectFilled(store);
    await store.saveGroup('after-revoke', GROUP_STATE);
    await expectFilled(stateStore(name, session('alice', 2)));
  });

  it('refuses a stale session after a re-seal and drops nothing', async () => {
    let current = session('alice', 1);
    const store = opened(name, () => current).store;

    await fill(store);
    current = session('alice', 2, 1);
    await store.loadGroup(GROUP_ID);
    const resealed = await rawRows(name);

    current = session('alice', 1);

    await expect(store.loadGroup(GROUP_ID)).rejects.toThrow(
      'Device sealed root was replaced.',
    );
    await expect(store.saveGroup(GROUP_ID, GROUP_STATE)).rejects.toThrow(
      'Device sealed root was replaced.',
    );
    expect(await rawRows(name)).toEqual(resealed);
    await expectFilled(stateStore(name, session('alice', 2)));
  });

  it('drops every entry under a root it cannot trace back', async () => {
    await fill(stateStore(name, session('alice', 1)));

    await expectEmpty(stateStore(name, session('alice', 3)));
    expect(await rawRows(name)).toEqual([]);
    await expectEmpty(stateStore(name, session('alice', 1)));
  });

  it('drops every entry when neither the root nor the replaced one opens them', async () => {
    await fill(stateStore(name, session('alice', 1)));

    await expectEmpty(stateStore(name, session('alice', 3, 2)));
    expect(await rawRows(name)).toEqual([]);
  });

  it('leaves the entries as they were when a re-seal is interrupted, then finishes it', async () => {
    await fill(stateStore(name, session('alice', 1)));
    await stateStore(name, session('alice', 1)).savePlaintext(
      GROUP_ID,
      'second',
      'second plaintext',
    );
    const before = await rawRows(name);
    const canary = await rawRows(name, 'canaries');
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let calls = 0;

    jest.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      calls += 1;

      if (calls === 2) throw new Error('interrupted');

      return await encrypt(...args);
    });
    const store = stateStore(name, session('alice', 2, 1));

    await expect(store.loadGroup(GROUP_ID)).rejects.toThrow('interrupted');
    expect(await rawRows(name)).toEqual(before);
    expect(await rawRows(name, 'canaries')).toEqual(canary);

    jest.restoreAllMocks();

    await expectFilled(store);
    expect(await store.loadPlaintext(GROUP_ID, 'second')).toBe(
      'second plaintext',
    );
  });

  it('drops the entries an interrupted re-seal left when neither root opens them', async () => {
    await fill(stateStore(name, session('alice', 1)));
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let calls = 0;

    jest.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      calls += 1;

      if (calls === 2) throw new Error('interrupted');

      return await encrypt(...args);
    });

    await expect(
      stateStore(name, session('alice', 2, 1)).loadGroup(GROUP_ID),
    ).rejects.toThrow('interrupted');
    jest.restoreAllMocks();

    await expectEmpty(stateStore(name, session('alice', 3)));
    expect(await rawRows(name)).toEqual([]);
  });

  it('rejects without a device sealed root and leaves the entries alone', async () => {
    await fill(stateStore(name, session('alice', 1)));
    const before = await rawRows(name);
    const store = stateStore(name, session('alice', undefined));

    await expect(store.loadGroup(GROUP_ID)).rejects.toThrow(
      'Device sealed root is not open.',
    );
    await expect(store.saveGroup(GROUP_ID, GROUP_STATE)).rejects.toThrow(
      'Device sealed root is not open.',
    );
    expect(await rawRows(name)).toEqual(before);
  });

  it('drops state stored before sealing', async () => {
    const legacy = indexedDB.open(name, 1);

    legacy.addEventListener('upgradeneeded', () => {
      legacy.result.createObjectStore('entries');
    });
    const database = await indexedDbRequest(legacy);
    const transaction = database.transaction('entries', 'readwrite');

    transaction
      .objectStore('entries')
      .put(GROUP_STATE, `alice/group/${GROUP_ID}`);
    transaction
      .objectStore('entries')
      .put(PLAINTEXT, `alice/plaintext/${GROUP_ID}/${CIPHERTEXT_ID}`);
    await indexedDbTransaction(transaction);
    database.close();

    await expectEmpty(stateStore(name, session('alice', 1)));
    expect(await rawRows(name)).toEqual([]);
  });

  it('forgets one identity and keeps the others', async () => {
    const alice = opened(name, () => session('alice', 1));

    await fill(alice.store);
    await fill(stateStore(name, session('bob', 1)));

    await alice.entries.forget('alice');

    expect((await rawRows(name, 'canaries')).map(({ key }) => key)).toEqual([
      'bob',
    ]);
    await expectEmpty(stateStore(name, session('alice', 1)));
    await expectFilled(stateStore(name, session('bob', 1)));
  });

  it('keeps every first write to a fresh database', async () => {
    const store = stateStore(name, session('alice', 1));

    await Promise.all([
      store.saveGroup(GROUP_ID, GROUP_STATE),
      store.saveKeyPackage(keyPackage()),
      store.savePlaintext(GROUP_ID, CIPHERTEXT_ID, PLAINTEXT),
    ]);

    await expectFilled(stateStore(name, session('alice', 1)));
  });

  it('serves the latest 2048 plaintexts from memory', async () => {
    const { entries, store } = opened(name, () => session('alice', 1));

    jest.spyOn(entries, 'put').mockResolvedValue(undefined);
    const get = jest.spyOn(entries, 'get').mockResolvedValue(undefined);

    for (let index = 0; index < 2048; index += 1) {
      await store.savePlaintext(GROUP_ID, `${index}`, `plaintext ${index}`);
    }
    expect(await store.loadPlaintext(GROUP_ID, '0')).toBe('plaintext 0');

    await store.savePlaintext(GROUP_ID, '2048', 'plaintext 2048');

    expect(await store.loadPlaintext(GROUP_ID, '0')).toBe('plaintext 0');
    expect(await store.loadPlaintext(GROUP_ID, '2048')).toBe('plaintext 2048');
    expect(get).not.toHaveBeenCalled();
    expect(await store.loadPlaintext(GROUP_ID, '1')).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
