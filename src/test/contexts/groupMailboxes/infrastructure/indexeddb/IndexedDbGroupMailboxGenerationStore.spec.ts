import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { GroupMailboxGenerationLog } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGenerationLog';
import { GroupMailboxGenerationSecret } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';
import { IndexedDbGroupMailboxGenerationStore } from '../../../../../contexts/groupMailboxes/infrastructure/indexeddb/IndexedDbGroupMailboxGenerationStore';
import { DeviceSealedEntryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';
import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../../shared/infrastructure/storage/indexedDbRequest';

const LABEL = 'pigeon-group-generations';
const CONVERSATION_ID = 'conversation-id-marker-62f1';
const TREE = 'tree-digest-marker-90bd';
const SECRET = new TextEncoder().encode('generation-secret-marker-0123456');

const root = (fill: number) => ({ getBuffer: () => Buffer.alloc(32, fill) });

const session = (current: number | undefined, previous?: number): Session =>
  ({
    deviceId: 'device-1',
    deviceSealedRootKey: current === undefined ? undefined : root(current),
    identity: { id: 'alice' },
    previousDeviceSealedRootKey:
      previous === undefined ? undefined : root(previous),
  }) as unknown as Session;

const generations = (name: string, current: Session) =>
  new IndexedDbGroupMailboxGenerationStore(
    new DeviceSealedEntryStore(name, LABEL),
    () => current,
  );

const log = () =>
  GroupMailboxGenerationLog.empty()
    .start(GroupMailboxGenerationSecret.fromBytes(SECRET), 0n, TREE)
    .advance(
      GroupMailboxGenerationSecret.fromBytes(new Uint8Array(32).fill(9)),
      2n,
      'tree-2',
      1_000,
    );

const rawText = async (name: string): Promise<string> => {
  const database = await indexedDbRequest(indexedDB.open(name));

  try {
    const texts = await Promise.all(
      [...database.objectStoreNames].map(async (table) => {
        const rows = database.transaction(table, 'readonly').objectStore(table);
        const [keys, values] = await Promise.all([
          indexedDbRequest(rows.getAllKeys()),
          indexedDbRequest<Uint8Array[]>(rows.getAll()),
        ]);

        return [
          JSON.stringify(keys),
          ...values.map((value) => Buffer.from(value).toString('latin1')),
        ].join('\n');
      }),
    );

    return texts.join('\n');
  } finally {
    database.close();
  }
};

describe('IndexedDbGroupMailboxGenerationStore', () => {
  let name: string;

  beforeEach(() => {
    name = `generations-${randomUUID()}`;
  });

  it('keeps the generation log of each conversation across reopening', async () => {
    await generations(name, session(1)).save(CONVERSATION_ID, log());

    const reopened = generations(name, session(1));

    expect((await reopened.load(CONVERSATION_ID)).toPrimitives()).toEqual(
      log().toPrimitives(),
    );
    expect((await reopened.load('other')).isEmpty()).toBe(true);
  });

  it('stores no generation secret, conversation id or tree in the clear', async () => {
    await generations(name, session(1)).save(CONVERSATION_ID, log());

    const stored = await rawText(name);
    const [first] = log().toPrimitives();

    for (const marker of [
      CONVERSATION_ID,
      TREE,
      first.secret,
      new TextDecoder().decode(SECRET),
    ]) {
      expect(stored).not.toContain(marker);
    }
  });

  it('keeps the log when a revoke of another device replaced the root', async () => {
    await generations(name, session(1)).save(CONVERSATION_ID, log());

    expect(
      (
        await generations(name, session(2, 1)).load(CONVERSATION_ID)
      ).toPrimitives(),
    ).toEqual(log().toPrimitives());
    expect(
      (
        await generations(name, session(2)).load(CONVERSATION_ID)
      ).toPrimitives(),
    ).toEqual(log().toPrimitives());
  });

  it('drops the log under a root it cannot trace back', async () => {
    await generations(name, session(1)).save(CONVERSATION_ID, log());

    expect(
      (await generations(name, session(3)).load(CONVERSATION_ID)).isEmpty(),
    ).toBe(true);
    expect(
      (await generations(name, session(1)).load(CONVERSATION_ID)).isEmpty(),
    ).toBe(true);
  });

  it('rejects without a device sealed root', async () => {
    await expect(
      generations(name, session(undefined)).save(CONVERSATION_ID, log()),
    ).rejects.toThrow('Device sealed root is not open.');
  });

  it('drops logs stored before sealing', async () => {
    const legacy = indexedDB.open(name, 1);

    legacy.addEventListener('upgradeneeded', () => {
      legacy.result.createObjectStore('entries');
    });
    const database = await indexedDbRequest(legacy);
    const transaction = database.transaction('entries', 'readwrite');

    transaction
      .objectStore('entries')
      .put(log().toPrimitives(), `alice/${CONVERSATION_ID}`);
    await indexedDbTransaction(transaction);
    database.close();

    expect(
      (await generations(name, session(1)).load(CONVERSATION_ID)).isEmpty(),
    ).toBe(true);
    expect(await rawText(name)).not.toContain(CONVERSATION_ID);
  });
});
