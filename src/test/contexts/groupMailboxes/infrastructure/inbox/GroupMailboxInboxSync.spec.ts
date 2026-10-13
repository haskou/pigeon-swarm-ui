import 'fake-indexeddb/auto';
import type { MockProxy } from 'jest-mock-extended';

import { mock } from 'jest-mock-extended';

import type { GroupMailboxOutboxRow } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxRow';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../../../contexts/mailboxes/domain/DirectMessageRecord';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { GroupMessageHistoryStore } from '../../../../../contexts/groupMailboxes/infrastructure/history/GroupMessageHistoryStore';
import { GroupMailboxInboxStore } from '../../../../../contexts/groupMailboxes/infrastructure/inbox/GroupMailboxInboxStore';
import { GroupMailboxInboxSync } from '../../../../../contexts/groupMailboxes/infrastructure/inbox/GroupMailboxInboxSync';
import { IndexedDbGroupMailboxGenerationStore } from '../../../../../contexts/groupMailboxes/infrastructure/indexeddb/IndexedDbGroupMailboxGenerationStore';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { GroupMailboxOutbox } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutbox';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DirectMailboxRecords } from '../../../../../contexts/mailboxes/domain/DirectMailboxRecords';
import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DirectMessageInboxKeys } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageInboxKeys';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';

const CONVERSATION = 'conversation-1';
const MARKER = 'group-plaintext-4c1f';

type Member = {
  control: GroupMailboxControl;
  direct: { from: string; plaintext: Uint8Array }[];
  engine: GroupMailboxMlsEngine;
  history: string;
  name: string;
  outbox: GroupMailboxOutbox;
  received: DirectMessageRecord[];
  session: Session;
  sync: GroupMailboxInboxSync;
};

let now = 1_000;
let database = 0;
let roster: ReadonlySet<string> = new Set();
let inboxes: Map<
  string,
  {
    envelopes: { body: string; cursor: number; envelopeId: string }[];
    readers: Set<string>;
    root: string;
  }
>;
let wire: MockProxy<PigeonMailboxClient>;
let channel: MailboxChannel;
let members: Map<string, Member>;

/**
 * A node holding the group inboxes. Appends need the inbox and are
 * idempotent per envelope id; reads and acks need an enrolled reader;
 * deletion needs the creation token.
 */
const fakeNode = (): void => {
  inboxes = new Map();
  wire = mock<PigeonMailboxClient>();
  const readable = (mailboxId: string, token: string) => {
    const inbox = inboxes.get(mailboxId);

    if (!inbox?.readers.has(MailboxCapability.hash(token))) {
      throw new MailboxUnavailableError();
    }

    return inbox;
  };

  wire.create.mockImplementation((mailboxId, creation) => {
    if (!inboxes.has(mailboxId)) {
      inboxes.set(mailboxId, {
        envelopes: [],
        readers: new Set([creation.readTokenHash]),
        root: creation.readTokenHash,
      });
    }

    return Promise.resolve();
  });
  wire.addReader.mockImplementation((mailboxId, token, readTokenHash) =>
    Promise.resolve().then(() => {
      readable(mailboxId, token).readers.add(readTokenHash);
    }),
  );
  wire.append.mockImplementation((mailboxId, _postToken, input) => {
    const inbox = inboxes.get(mailboxId);

    if (!inbox) return Promise.reject(new MailboxUnavailableError());
    const known = inbox.envelopes.find(
      ({ envelopeId }) => envelopeId === input.envelopeId,
    );

    if (known) return Promise.resolve({ cursor: known.cursor });
    const cursor = inbox.envelopes.length + 1;

    inbox.envelopes.push({ ...input, cursor });

    return Promise.resolve({ cursor });
  });
  wire.read.mockImplementation((mailboxId, token, after, limit) =>
    Promise.resolve().then(() => {
      const unread = readable(mailboxId, token).envelopes.filter(
        ({ cursor }) => cursor > after,
      );

      return {
        envelopes: unread.slice(0, limit),
        hasMore: unread.length > limit,
      };
    }),
  );
  wire.acknowledge.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => {
      readable(mailboxId, token);
    }),
  );
  wire.delete.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => {
      if (inboxes.get(mailboxId)?.root !== MailboxCapability.hash(token)) {
        throw new MailboxUnavailableError();
      }
      inboxes.delete(mailboxId);
    }),
  );
  channel = new MailboxChannel(wire, () => Promise.resolve('nonce'));
};

/** Local storage for the inbox cursors. */
const memoryStorage = (): void => {
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
};

const member = (name: string): Member => {
  const seed = ++database;
  const databaseName = `group-sync-${seed}`;
  const session = {
    deviceCredentialKeyPair: {
      toPrimitives: () => ({ publicKey: `device-${name}` }),
    },
    deviceId: 'd1',
    deviceSealedRootKey: {
      getBuffer: () => Buffer.alloc(32, seed),
    },
    identity: { id: name },
  } as unknown as Session;
  const engine = new GroupMailboxMlsEngine(
    { deviceId: 'd1', identityId: name },
    new IndexedDbMlsStateStore(`${databaseName}-mls`, name),
    new IndexedDbGroupMailboxGenerationStore(
      `${databaseName}-generations`,
      name,
    ),
    () => Promise.resolve(roster),
    () => now,
  );
  const rows = new Map<string, GroupMailboxOutboxRow>();
  const outbox = new GroupMailboxOutbox(
    session,
    engine,
    channel,
    {
      forget: () => Promise.resolve(rows.clear()),
      load: () => Promise.resolve([...rows.values()]),
      remove: (_identityId, id) => Promise.resolve(void rows.delete(id)),
      save: (_session, row) => Promise.resolve(void rows.set(row.id, row)),
    },
    () => now,
  );
  const direct: Member['direct'] = [];
  const control = new GroupMailboxControl(
    name,
    engine,
    () => Promise.resolve(roster),
    {
      send: (peer, plaintext) => {
        members.get(peer)?.direct.push({ from: name, plaintext });

        return Promise.resolve();
      },
    },
    outbox,
  );
  const created: Member = {
    control,
    direct,
    engine,
    history: `${databaseName}-history`,
    name,
    outbox,
    received: [],
    session,
    sync: new GroupMailboxInboxSync(
      session,
      engine,
      control,
      channel,
      wire,
      new GroupMailboxInboxStore(),
      new GroupMessageHistoryStore(`${databaseName}-history`),
    ),
  };

  members.set(name, created);

  return created;
};

const until = async (ready: () => boolean): Promise<void> => {
  for (let turn = 0; turn < 200 && !ready(); turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(ready()).toBe(true);
};

/** Hands every record waiting in the 1:1 mailbox of `to` to its control. */
const pump = async (to: Member): Promise<void> => {
  while (to.direct.length > 0) {
    const { from, plaintext } = to.direct.shift() as Member['direct'][number];

    await to.control.receiveDirect(from, plaintext);
  }
};

const sync = (to: Member): Promise<void> =>
  to.sync.sync(CONVERSATION, new AbortController().signal, (records) => {
    to.received.push(...records);
  });

/** `inviter` adds `joiners`; each joins from its welcome. */
const add = async (inviter: Member, joiners: Member[]): Promise<void> => {
  const adding = inviter.control.add(
    CONVERSATION,
    joiners.map(({ name }) => name),
  );

  await until(() => joiners.every(({ direct }) => direct.length > 0));
  for (const joiner of joiners) await pump(joiner);
  await until(() => inviter.direct.length === joiners.length);
  await pump(inviter);
  await adding;
  for (const joiner of joiners) await pump(joiner);
};

const sent = (author: string, id: string, text = MARKER) =>
  DirectMailboxRecords.sent({
    authorId: author,
    conversationId: CONVERSATION,
    createdAt: now,
    encryptedPayload: text,
    id,
    previousMessageIds: [],
  });

const send = (from: Member, record: DirectMessageRecord): Promise<void> =>
  from.outbox.enqueueMessage(
    CONVERSATION,
    record.id,
    DirectMessageMailboxRecord.encode(record),
  );

const ids = (records: DirectMessageRecord[]): string[] =>
  records.map(({ id, type }) => `${type}:${id}`);

/** Appends `plaintext` to the inbox of `to` of its current generation. */
const inject = async (to: Member, plaintext: Uint8Array): Promise<void> => {
  await channel.send(
    GroupMailboxKeySchedule.inbox(
      (await to.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(to.name),
    ),
    plaintext,
  );
};

/** Retries every outbox after the longest backoff. */
const retry = async (...senders: Member[]): Promise<void> => {
  now += GroupMailboxOutbox.RETRY_MAX_MS;
  for (const sender of senders) await sender.outbox.resume();
};

describe('GroupMailboxInboxSync on the real ts-mls library', () => {
  let alice: Member;
  let bob: Member;
  let carol: Member;

  beforeEach(async () => {
    now = 1_000;
    roster = new Set(['alice', 'bob', 'carol']);
    memoryStorage();
    fakeNode();
    members = new Map();
    alice = member('alice');
    bob = member('bob');
    carol = member('carol');
    await alice.engine.createGroup(CONVERSATION);
    await sync(alice);
    await add(alice, [bob, carol]);
    await Promise.all([sync(alice), sync(bob), sync(carol)]);
  });

  afterEach(() => {
    for (const { control, outbox } of members.values()) {
      control.close();
      outbox.stop();
    }
  });

  it('delivers a message to every member, the sender included', async () => {
    await send(alice, sent('alice', 'm1'));

    for (const reader of [alice, bob, carol]) {
      await sync(reader);
      expect(ids(reader.received)).toEqual(['sent:m1']);
      expect(reader.received[0]).toMatchObject({
        authorId: 'alice',
        encryptedPayload: MARKER,
      });
    }
  });

  it('never puts the plaintext on the node', async () => {
    await send(alice, sent('alice', 'm1'));

    for (const { envelopes } of inboxes.values()) {
      for (const { body } of envelopes) expect(body).not.toContain(MARKER);
    }
  });

  it('hands a message over once across passes', async () => {
    await send(alice, sent('alice', 'm1'));
    await sync(bob);
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('keeps a removed member from reading later messages', async () => {
    await alice.control.remove(CONVERSATION, ['carol']);
    await sync(bob);
    await sync(alice);
    await send(alice, sent('alice', 'after-removal'));
    await send(bob, sent('bob', 'bob-after-removal'));
    await sync(carol);

    expect(carol.received).toEqual([]);
    await sync(bob);
    expect(ids(bob.received)).toEqual([
      'sent:after-removal',
      'sent:bob-after-removal',
    ]);
    const current = await alice.engine.generation(CONVERSATION);
    const carolGeneration = await carol.engine.generation(CONVERSATION);

    expect(carolGeneration.secret.isEqual(current.secret)).toBe(false);
    expect(
      inboxes.has(
        GroupMailboxKeySchedule.inbox(
          current.secret,
          IdentityId.fromString('carol'),
        ).mailboxId,
      ),
    ).toBe(false);
  });

  it('rejects a message whose author is not its MLS sender', async () => {
    await send(bob, sent('alice', 'forged'));
    await sync(carol);

    expect(carol.received).toEqual([]);
  });

  it('rejects a message from outside the group and keeps reading', async () => {
    const mallory = member('mallory');

    await mallory.engine.createGroup(CONVERSATION);
    const ciphertext = await mallory.engine.encrypt(
      CONVERSATION,
      DirectMessageMailboxRecord.encode(sent('mallory', 'outsider')),
    );

    await inject(
      bob,
      GroupMailboxControlRecord.encode({
        ciphertext,
        conversationId: CONVERSATION,
        type: 'message',
      }),
    );
    await inject(bob, new TextEncoder().encode('not a record'));
    await send(alice, sent('alice', 'm1'));
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('rejects a message reusing the id of another author', async () => {
    await send(alice, sent('alice', 'm1'));
    await send(bob, sent('bob', 'm1', 'hijacked'));
    await sync(carol);

    expect(carol.received).toEqual([
      expect.objectContaining({ authorId: 'alice', encryptedPayload: MARKER }),
    ]);
  });

  it('accepts edits and deletions from the original author only', async () => {
    await send(alice, sent('alice', 'm1'));
    await sync(carol);
    const target = { conversationId: CONVERSATION, createdAt: now };

    await send(
      bob,
      DirectMailboxRecords.edited({
        ...target,
        authorId: 'bob',
        encryptedPayload: 'forged edit',
        id: 'e-bob',
        targetMessageId: 'm1',
      }),
    );
    await send(bob, {
      ...DirectMailboxRecords.deleted({
        authorId: 'bob',
        conversationId: CONVERSATION,
        targetMessageId: 'm1',
      }),
      id: 'd-bob',
    });
    await send(
      alice,
      DirectMailboxRecords.edited({
        ...target,
        authorId: 'alice',
        encryptedPayload: 'edit',
        id: 'e-alice',
        targetMessageId: 'm1',
      }),
    );
    await send(alice, {
      ...DirectMailboxRecords.deleted({
        authorId: 'alice',
        conversationId: CONVERSATION,
        targetMessageId: 'm1',
      }),
      id: 'd-alice',
    });
    await sync(carol);

    expect(ids(carol.received)).toEqual([
      'sent:m1',
      'edited:e-alice',
      'deleted:d-alice',
    ]);
  });

  it('accepts an edit after a restart from the stored history', async () => {
    await send(alice, sent('alice', 'm1'));
    await sync(carol);
    const restarted = new GroupMailboxInboxSync(
      carol.session,
      carol.engine,
      carol.control,
      channel,
      wire,
      new GroupMailboxInboxStore(),
      new GroupMessageHistoryStore(carol.history),
    );

    await send(
      alice,
      DirectMailboxRecords.edited({
        authorId: 'alice',
        conversationId: CONVERSATION,
        createdAt: now,
        encryptedPayload: 'edit',
        id: 'e-alice',
        targetMessageId: 'm1',
      }),
    );
    const received: DirectMessageRecord[] = [];

    await restarted.sync(CONVERSATION, new AbortController().signal, (r) => {
      received.push(...r);
    });

    expect(ids(received)).toEqual(['edited:e-alice']);
  });

  it('keeps a copy whose inbox is missing and appends it on retry', async () => {
    const bobInbox = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString('bob'),
    ).mailboxId;

    inboxes.delete(bobInbox);
    await send(alice, sent('alice', 'm1'));

    expect(alice.outbox.pending(CONVERSATION)).toEqual(['m1']);
    await sync(bob);
    await retry(alice);
    await sync(bob);

    expect(alice.outbox.pending(CONVERSATION)).toEqual([]);
    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('re-encrypts a stranded message in the next generation, never for a joiner', async () => {
    await alice.control.remove(CONVERSATION, ['carol']);
    await Promise.all([sync(alice), sync(bob)]);
    const bobInbox = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString('bob'),
    ).mailboxId;

    inboxes.delete(bobInbox);
    await send(alice, sent('alice', 'stranded'));
    const stranded = (await alice.engine.generation(CONVERSATION)).index;

    roster = new Set(['alice', 'bob', 'carol', 'dave']);
    const dave = member('dave');

    await add(alice, [dave]);
    await Promise.all([sync(alice), sync(dave), sync(bob)]);
    await retry(alice);
    await sync(bob);
    await retry(alice);
    await sync(bob);
    await sync(dave);

    expect((await bob.engine.generation(CONVERSATION)).index).toBeGreaterThan(
      stranded,
    );
    expect(ids(bob.received)).toEqual(['sent:stranded']);
    expect(dave.received).toEqual([]);
    expect(alice.outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('drops a record still queued after the expiry and reports it', async () => {
    const failures: string[] = [];

    alice.outbox.subscribe(({ reference }) => failures.push(reference));
    inboxes.delete(
      GroupMailboxKeySchedule.inbox(
        (await bob.engine.generation(CONVERSATION)).secret,
        IdentityId.fromString('bob'),
      ).mailboxId,
    );
    await send(alice, sent('alice', 'm1'));
    now += GroupMailboxOutbox.EXPIRY_MS;
    await alice.outbox.resume();

    expect(failures).toEqual(['m1']);
    expect(alice.outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('deletes its retired inbox once the drain window closes', async () => {
    const keys = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString('bob'),
    );
    const retired = keys.mailboxId;

    await alice.control.remove(CONVERSATION, ['carol']);
    await sync(bob);

    expect(inboxes.has(retired)).toBe(true);
    now += GroupMailboxGeneration.DRAIN_WINDOW_MS + 1;
    await sync(bob);

    expect(inboxes.has(retired)).toBe(false);
    expect(wire.delete).toHaveBeenCalledWith(
      retired,
      DirectMessageInboxKeys.readersFor(bob.session, keys).root,
    );
  });
});
