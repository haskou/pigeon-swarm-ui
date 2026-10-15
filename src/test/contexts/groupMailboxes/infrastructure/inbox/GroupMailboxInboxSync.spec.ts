import 'fake-indexeddb/auto';
import type { MockProxy } from 'jest-mock-extended';

import { mock } from 'jest-mock-extended';

import type { GroupMailboxGenerationRepository } from '../../../../../contexts/groupMailboxes/domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxOutboxRow } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxRow';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../../../contexts/mailboxes/domain/DirectMessageRecord';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { GroupMessageId } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMessageId';
import { GroupMessageHistoryStore } from '../../../../../contexts/groupMailboxes/infrastructure/history/GroupMessageHistoryStore';
import { GroupMailboxInboxStore } from '../../../../../contexts/groupMailboxes/infrastructure/inbox/GroupMailboxInboxStore';
import { GroupMailboxInboxSync } from '../../../../../contexts/groupMailboxes/infrastructure/inbox/GroupMailboxInboxSync';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { GroupMailboxOutbox } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutbox';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DirectMailboxRecords } from '../../../../../contexts/mailboxes/domain/DirectMailboxRecords';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DirectMessageInboxKeys } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageInboxKeys';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { MlsTestIdentity } from '../../../communities/infrastructure/mls/MlsTestIdentity';
import { sealedGroupStores } from '../sealedGroupStores';

const CONVERSATION = 'conversation-1';
const MARKER = 'group-plaintext-4c1f';

type Member = {
  control: GroupMailboxControl;
  direct: { from: string; plaintext: Uint8Array }[];
  engine: GroupMailboxMlsEngine;
  history: string;
  id: string;
  name: string;
  outbox: GroupMailboxOutbox;
  received: DirectMessageRecord[];
  session: Session;
  sync: GroupMailboxInboxSync;
};

let now = 1_000;
let database = 0;
let cast: Record<string, MlsTestIdentity>;
let roster = GroupMailboxRoster.empty();

const id = (name: string): string => cast[name].id;

/** The roster of a conversation whose creator is `creator`, if any. */
const rosterOf = (names: string[], creator?: string): GroupMailboxRoster =>
  GroupMailboxRoster.of({
    adminIds: [],
    creatorId: creator && id(creator),
    participantIds: names.map(id),
  });
let inboxes: Map<
  string,
  {
    envelopes: { body: string; cursor: number; envelopeId: string }[];
    /** The acknowledged cursor of each reader, by its token hash. */
    readers: Map<string, number>;
    root: string;
  }
>;
let wire: MockProxy<PigeonMailboxClient>;
let channel: MailboxChannel;
let members: Map<string, Member>;

/**
 * A node holding the group inboxes. Appends need the inbox and are
 * idempotent per envelope id; reads, acks and the reader list need an
 * enrolled reader; deletion needs the creation token.
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
        readers: new Map([[creation.readTokenHash, 0]]),
        root: creation.readTokenHash,
      });
    }

    return Promise.resolve();
  });
  wire.addReader.mockImplementation((mailboxId, token, readTokenHash) =>
    Promise.resolve().then(() => {
      const { readers } = readable(mailboxId, token);

      readers.set(readTokenHash, readers.get(readTokenHash) ?? 0);
    }),
  );
  wire.readers.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => ({
      maxReaders: 16,
      readers: [...readable(mailboxId, token).readers].map(
        ([readTokenHash, ackedCursor]) => ({ ackedCursor, readTokenHash }),
      ),
    })),
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
  wire.acknowledge.mockImplementation((mailboxId, token, upTo) =>
    Promise.resolve().then(() => {
      const { readers } = readable(mailboxId, token);
      const hash = MailboxCapability.hash(token);

      readers.set(hash, Math.max(readers.get(hash) ?? 0, upTo));
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
  const identityId = id(name);
  const session = {
    deviceCredentialKeyPair: cast[name].deviceKeyPair(),
    deviceId: 'd1',
    deviceSealedRootKey: {
      getBuffer: () => Buffer.alloc(32, seed),
    },
    identity: { id: identityId },
  } as unknown as Session;
  const stores = sealedGroupStores(databaseName, identityId);
  const engine = new GroupMailboxMlsEngine(
    cast[name].signer(),
    stores.state,
    stores.generations,
    () => Promise.resolve(roster),
    () => Promise.resolve([cast[name].deviceCredential()]),
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
      remove: (_identityId, rowId) => Promise.resolve(void rows.delete(rowId)),
      save: (_session, row) => Promise.resolve(void rows.set(row.id, row)),
    },
    () => Promise.resolve(roster),
    () => now,
  );
  const direct: Member['direct'] = [];
  const control = new GroupMailboxControl(
    cast[name].owner(),
    engine,
    () => Promise.resolve(roster),
    {
      send: (_conversationId, peer, plaintext) => {
        members.get(peer)?.direct.push({ from: identityId, plaintext });

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
    id: identityId,
    name,
    outbox,
    received: [],
    session,
    sync: new GroupMailboxInboxSync(
      () => session,
      engine,
      control,
      channel,
      wire,
      new GroupMailboxInboxStore(),
      new GroupMessageHistoryStore(`${databaseName}-history`),
      mock<GroupMailboxGenerationRepository>(),
      mock<DirectMessageReaderSet>(),
    ),
  };

  members.set(identityId, created);

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

/**
 * Passes of `to`'s inbox sync, on one sync, as if its group also held a
 * leaf for each of `siblings`, other devices of its identity that never
 * read.
 */
const syncBeside = (to: Member, siblings: string[]): (() => Promise<void>) => {
  const beside = new GroupMailboxInboxSync(
    () => to.session,
    {
      decrypt: (conversationId, ciphertext) =>
        to.engine.decrypt(conversationId, ciphertext),
      devices: async (conversationId) => [
        ...(await to.engine.devices(conversationId)),
        ...siblings,
      ],
      drainedGenerations: (id) => to.engine.drainedGenerations(id),
      readableGenerations: (id) => to.engine.readableGenerations(id),
    },
    to.control,
    channel,
    wire,
    new GroupMailboxInboxStore(),
    new GroupMessageHistoryStore(to.history),
    mock<GroupMailboxGenerationRepository>(),
    mock<DirectMessageReaderSet>(),
  );

  return () =>
    beside.sync(CONVERSATION, new AbortController().signal, (records) => {
      to.received.push(...records);
    });
};

/** `inviter` adds `joiners`; each joins from its welcome. */
const add = async (inviter: Member, joiners: Member[]): Promise<void> => {
  const adding = inviter.control.add(
    CONVERSATION,
    joiners.map((joiner) => joiner.id),
  );

  await until(() => joiners.every(({ direct }) => direct.length > 0));
  for (const joiner of joiners) await pump(joiner);
  await until(() => inviter.direct.length === joiners.length);
  await pump(inviter);
  await adding;
  for (const joiner of joiners) await pump(joiner);
};

const labels = new Map<string, string>();
const made = new Map<string, string>();

/** The author-bound id that `label` of the member `author` stands for. */
const mid = (author: string, label: string): string => {
  const key = `${author}/${label}`;
  const known = made.get(key);

  if (known) return known;
  const messageId = GroupMessageId.create(id(author));

  made.set(key, messageId);
  labels.set(messageId, label);

  return messageId;
};

const sent = (author: string, messageId: string, text = MARKER) =>
  DirectMailboxRecords.sent({
    authorId: id(author),
    conversationId: CONVERSATION,
    createdAt: now,
    encryptedPayload: text,
    id: messageId,
    previousMessageIds: [],
  });

const edited = (author: string, messageId: string, targetMessageId: string) =>
  DirectMailboxRecords.edited({
    authorId: id(author),
    conversationId: CONVERSATION,
    createdAt: now,
    encryptedPayload: 'edit',
    id: messageId,
    targetMessageId,
  });

const deleted = (
  author: string,
  messageId: string,
  targetMessageId: string,
) => ({
  ...DirectMailboxRecords.deleted({
    authorId: id(author),
    conversationId: CONVERSATION,
    targetMessageId,
  }),
  id: messageId,
});

const poll = (author: string, pollId: string) =>
  DirectMailboxRecords.poll({
    allowsMultipleVotes: false,
    authorId: id(author),
    conversationId: CONVERSATION,
    createdAt: now,
    id: pollId,
    options: [
      { id: 'tea', text: 'Tea' },
      { id: 'coffee', text: 'Coffee' },
    ],
    question: 'Which one?',
  });

const pollVote = (author: string, voteId: string, targetPollId: string) => ({
  ...DirectMailboxRecords.pollVote({
    authorId: id(author),
    conversationId: CONVERSATION,
    createdAt: now,
    optionIds: ['tea'],
    targetPollId,
  }),
  id: voteId,
});

const pollClose = (author: string, closeId: string, targetPollId: string) => ({
  ...DirectMailboxRecords.pollClose({
    authorId: id(author),
    conversationId: CONVERSATION,
    createdAt: now,
    targetPollId,
  }),
  id: closeId,
});

const send = (from: Member, record: DirectMessageRecord): Promise<void> =>
  from.outbox.enqueueMessage(
    CONVERSATION,
    record.id,
    DirectMessageMailboxRecord.encode(record),
  );

const ids = (records: DirectMessageRecord[]): string[] =>
  records.map(({ id, type }) => `${type}:${labels.get(id) ?? id}`);

/** Appends `plaintext` to the inbox of `to` of its current generation. */
const inject = async (to: Member, plaintext: Uint8Array): Promise<void> => {
  await channel.send(
    GroupMailboxKeySchedule.inbox(
      (await to.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(to.id),
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

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast([
      'alice',
      'bob',
      'carol',
      'dave',
      'mallory',
    ]);
  });

  beforeEach(async () => {
    now = 1_000;
    roster = rosterOf(['alice', 'bob', 'carol'], 'alice');
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
    await send(alice, sent('alice', mid('alice', 'm1')));

    for (const reader of [alice, bob, carol]) {
      await sync(reader);
      expect(ids(reader.received)).toEqual(['sent:m1']);
      expect(reader.received[0]).toMatchObject({
        authorId: alice.id,
        encryptedPayload: MARKER,
      });
    }
  });

  it('never puts the plaintext on the node', async () => {
    await send(alice, sent('alice', mid('alice', 'm1')));

    for (const { envelopes } of inboxes.values()) {
      for (const { body } of envelopes) expect(body).not.toContain(MARKER);
    }
  });

  it('hands a message over once across passes', async () => {
    await send(alice, sent('alice', mid('alice', 'm1')));
    await sync(bob);
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('keeps a removed member from reading later messages', async () => {
    await alice.control.remove(CONVERSATION, [carol.id]);
    await sync(bob);
    await sync(alice);
    await send(alice, sent('alice', mid('alice', 'after-removal')));
    await send(bob, sent('bob', mid('bob', 'bob-after-removal')));
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
          IdentityId.fromString(carol.id),
        ).mailboxId,
      ),
    ).toBe(false);
  });

  it('rejects a message whose author is not its MLS sender', async () => {
    await send(bob, sent('alice', mid('alice', 'forged')));
    await sync(carol);

    expect(carol.received).toEqual([]);
  });

  it('rejects a message from outside the group and keeps reading', async () => {
    const mallory = member('mallory');

    await mallory.engine.createGroup(CONVERSATION);
    const ciphertext = await mallory.engine.encrypt(
      CONVERSATION,
      DirectMessageMailboxRecord.encode(
        sent('mallory', mid('mallory', 'outsider')),
      ),
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
    await send(alice, sent('alice', mid('alice', 'm1')));
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('rejects a message reusing the id of another author', async () => {
    await send(alice, sent('alice', mid('alice', 'm1')));
    await send(bob, sent('bob', mid('alice', 'm1'), 'hijacked'));
    await sync(carol);

    expect(carol.received).toEqual([
      expect.objectContaining({ authorId: alice.id, encryptedPayload: MARKER }),
    ]);
  });

  it('rejects a squatter who sends under the id of another author first', async () => {
    const victim = mid('alice', 'm1');

    await send(bob, sent('bob', victim, 'squatted'));
    await send(alice, sent('alice', victim));
    await send(bob, edited('bob', mid('bob', 'e-bob'), victim));
    await send(bob, deleted('bob', mid('bob', 'd-bob'), victim));
    await sync(carol);

    expect(ids(carol.received)).toEqual(['sent:m1']);
    expect(carol.received[0]).toMatchObject({
      authorId: alice.id,
      encryptedPayload: MARKER,
    });
  });

  it('rejects every record whose id or target is not bound to its sender', async () => {
    const own = mid('bob', 'b1');

    await send(bob, sent('bob', 'legacy-id'));
    await send(bob, sent('bob', own));
    await send(bob, edited('bob', mid('alice', 'e1'), own));
    await send(bob, deleted('bob', mid('alice', 'd1'), own));
    await send(bob, edited('bob', mid('bob', 'e2'), 'legacy-id'));
    await send(bob, {
      ...DirectMailboxRecords.reaction({
        action: 'add',
        authorId: bob.id,
        conversationId: CONVERSATION,
        createdAt: now,
        emoji: '+1',
        targetMessageId: own,
      }),
      id: mid('alice', 'r1'),
    });
    await sync(carol);

    expect(ids(carol.received)).toEqual(['sent:b1']);
  });

  it('accepts edits and deletions from the original author only', async () => {
    const target = mid('alice', 'm1');

    await send(alice, sent('alice', target));
    await sync(carol);
    await send(bob, edited('bob', mid('bob', 'e-bob'), target));
    await send(bob, deleted('bob', mid('bob', 'd-bob'), target));
    await send(alice, edited('alice', mid('alice', 'e-alice'), target));
    await send(alice, deleted('alice', mid('alice', 'd-alice'), target));
    await sync(carol);

    expect(ids(carol.received)).toEqual([
      'sent:m1',
      'edited:e-alice',
      'deleted:d-alice',
    ]);
  });

  it('accepts a poll and votes from their sender, a close from the poll creator only', async () => {
    const target = mid('alice', 'p1');

    await send(alice, poll('alice', target));
    await send(bob, poll('bob', mid('alice', 'p-squatted')));
    await send(bob, pollVote('bob', mid('bob', 'v-bob'), target));
    await send(bob, pollVote('alice', mid('alice', 'v-forged'), target));
    await send(bob, pollClose('bob', mid('bob', 'c-bob'), target));
    await send(alice, pollClose('alice', mid('alice', 'c-alice'), target));
    await sync(carol);

    expect(ids(carol.received)).toEqual([
      'poll:p1',
      'poll_vote:v-bob',
      'poll_close:c-alice',
    ]);
  });

  it('hands over a typing notice from its sender only, never storing it', async () => {
    const typing = (author: string, typingId: string) =>
      DirectMailboxRecords.typing({
        authorId: id(author),
        conversationId: CONVERSATION,
        createdAt: now,
        id: typingId,
      });

    await send(bob, typing('bob', mid('bob', 't-bob')));
    await send(bob, typing('alice', mid('alice', 't-forged')));
    await sync(carol);

    expect(ids(carol.received)).toEqual(['typing:t-bob']);
    expect(
      await new GroupMessageHistoryStore(carol.history).load(
        carol.session,
        CONVERSATION,
        50,
      ),
    ).toEqual([]);
  });

  it('accepts an edit after a restart from the stored history', async () => {
    await send(alice, sent('alice', mid('alice', 'm1')));
    await sync(carol);
    const restarted = new GroupMailboxInboxSync(
      () => carol.session,
      carol.engine,
      carol.control,
      channel,
      wire,
      new GroupMailboxInboxStore(),
      new GroupMessageHistoryStore(carol.history),
      mock<GroupMailboxGenerationRepository>(),
      mock<DirectMessageReaderSet>(),
    );

    await send(
      alice,
      edited('alice', mid('alice', 'e-alice'), mid('alice', 'm1')),
    );
    const received: DirectMessageRecord[] = [];

    await restarted.sync(CONVERSATION, new AbortController().signal, (r) => {
      received.push(...r);
    });

    expect(ids(received)).toEqual(['edited:e-alice']);
  });

  it('drops a forged future-epoch envelope without stalling the removal behind it', async () => {
    const retired = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    ).mailboxId;

    // A patched client of carol forks the group into an epoch only she holds.
    roster = rosterOf(['alice', 'carol']);
    await carol.engine.remove(CONVERSATION, [bob.id], () => Promise.resolve());
    roster = rosterOf(['alice', 'bob', 'carol'], 'alice');
    await inject(
      bob,
      GroupMailboxControlRecord.encode({
        ciphertext: await carol.engine.encrypt(
          CONVERSATION,
          DirectMessageMailboxRecord.encode(
            sent('carol', mid('carol', 'ahead')),
          ),
        ),
        conversationId: CONVERSATION,
        type: 'message',
      }),
    );
    const forged = inboxes.get(retired)?.envelopes.length ?? 0;

    await alice.control.remove(CONVERSATION, [carol.id]);
    await sync(bob);
    await send(alice, sent('alice', mid('alice', 'after')));
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:after']);
    expect(
      wire.acknowledge.mock.calls.some(
        ([mailboxId, , upTo]) => mailboxId === retired && upTo >= forged,
      ),
    ).toBe(true);
    expect(
      (await bob.engine.generation(CONVERSATION)).secret.isEqual(
        (await alice.engine.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
  });

  it('keeps an envelope whose plaintext could not be stored and reads it again', async () => {
    await send(alice, sent('alice', mid('alice', 'm1')));
    const save = jest
      .spyOn(IndexedDbMlsStateStore.prototype, 'savePlaintext')
      .mockRejectedValueOnce(new Error('quota'));

    await expect(sync(bob)).rejects.toThrow('quota');
    save.mockRestore();
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('drops an envelope that keeps failing to open and reads on', async () => {
    const failing = new GroupMailboxInboxSync(
      () => bob.session,
      {
        decrypt: () => Promise.reject(new Error('unexpected')),
        devices: (id) => bob.engine.devices(id),
        drainedGenerations: (id) => bob.engine.drainedGenerations(id),
        readableGenerations: (id) => bob.engine.readableGenerations(id),
      },
      bob.control,
      channel,
      wire,
      new GroupMailboxInboxStore(),
      new GroupMessageHistoryStore(bob.history),
      mock<GroupMailboxGenerationRepository>(),
      mock<DirectMessageReaderSet>(),
    );
    const pass = () =>
      failing.sync(CONVERSATION, new AbortController().signal, (records) => {
        expect(records).toEqual([]);
      });

    await send(alice, sent('alice', mid('alice', 'm1')));
    for (let turn = 1; turn < GroupMailboxInboxSync.MAX_FAILURES; turn += 1) {
      await expect(pass()).rejects.toThrow('unexpected');
    }
    await pass();
    await send(alice, sent('alice', mid('alice', 'm2')));
    await sync(bob);

    expect(ids(bob.received)).toEqual(['sent:m2']);
  });

  it('keeps a copy whose inbox is missing and appends it on retry', async () => {
    const bobInbox = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    ).mailboxId;

    inboxes.delete(bobInbox);
    await send(alice, sent('alice', mid('alice', 'm1')));

    expect(
      alice.outbox.items(CONVERSATION).map(({ reference }) => reference),
    ).toEqual([mid('alice', 'm1')]);
    await sync(bob);
    await retry(alice);
    await sync(bob);

    expect(alice.outbox.items(CONVERSATION)).toEqual([]);
    expect(ids(bob.received)).toEqual(['sent:m1']);
  });

  it('re-encrypts a stranded message in the next generation, never for a joiner', async () => {
    await alice.control.remove(CONVERSATION, [carol.id]);
    await Promise.all([sync(alice), sync(bob)]);
    const bobInbox = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    ).mailboxId;

    inboxes.delete(bobInbox);
    await send(alice, sent('alice', mid('alice', 'stranded')));
    const stranded = (await alice.engine.generation(CONVERSATION)).index;

    roster = rosterOf(['alice', 'bob', 'carol', 'dave'], 'alice');
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
    expect(alice.outbox.items(CONVERSATION)).toEqual([]);
  });

  it('drops a record still queued after the expiry and reports it', async () => {
    const failures: string[] = [];

    alice.outbox.subscribe(({ reference }) => failures.push(reference));
    inboxes.delete(
      GroupMailboxKeySchedule.inbox(
        (await bob.engine.generation(CONVERSATION)).secret,
        IdentityId.fromString(bob.id),
      ).mailboxId,
    );
    await send(alice, sent('alice', mid('alice', 'm1')));
    // Records queued within one millisecond are stamped a millisecond apart.
    now += GroupMailboxOutbox.EXPIRY_MS + 1_000;
    await alice.outbox.resume();

    expect(failures).toEqual([mid('alice', 'm1')]);
    expect(alice.outbox.items(CONVERSATION)).toEqual([]);
  });

  it('deletes its retired inbox once the drain window closes', async () => {
    const keys = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    );
    const retired = keys.mailboxId;

    await alice.control.remove(CONVERSATION, [carol.id]);
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

  it('enrols the readers of its other devices once, before acknowledging', async () => {
    const keys = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    );
    const laptop = cast.bob.deviceCredential('d2');
    const enrolled = MailboxCapability.hash(
      DirectMessageInboxKeys.readersFor(bob.session, keys, laptop).device,
    );

    const pass = syncBeside(bob, [laptop]);

    wire.addReader.mockClear();
    wire.acknowledge.mockClear();
    await send(alice, sent('alice', mid('alice', 'm1')));
    await pass();
    await send(alice, sent('alice', mid('alice', 'm2')));
    await pass();
    const enrolments = wire.addReader.mock.invocationCallOrder.filter(
      (_order, call) => wire.addReader.mock.calls[call][2] === enrolled,
    );

    expect(ids(bob.received)).toEqual(['sent:m1', 'sent:m2']);
    expect(enrolments).toHaveLength(1);
    expect(enrolments[0]).toBeLessThan(
      Math.min(...wire.acknowledge.mock.invocationCallOrder),
    );
    expect(inboxes.get(keys.mailboxId)?.readers.get(enrolled)).toBe(0);
  });

  it('leaves a drained inbox to retention while another device lags', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const laptop = cast.bob.deviceCredential('d2');
    const retired = GroupMailboxKeySchedule.inbox(
      (await bob.engine.generation(CONVERSATION)).secret,
      IdentityId.fromString(bob.id),
    ).mailboxId;

    await send(alice, sent('alice', mid('alice', 'm1')));
    await syncBeside(bob, [laptop])();
    await alice.control.remove(CONVERSATION, [carol.id]);
    await sync(bob);
    now += GroupMailboxGeneration.DRAIN_WINDOW_MS + 1;
    await sync(bob);
    await sync(bob);

    expect(inboxes.has(retired)).toBe(true);
    expect(wire.delete).not.toHaveBeenCalledWith(retired, expect.anything());
    expect(
      debug.mock.calls.filter(
        ([line]) => line === 'Group inboxes left to retention: 1.',
      ),
    ).toHaveLength(1);
    debug.mockRestore();
  });

  it('sends, receives and reloads a 500-message page (benchmark)', async () => {
    const count = 500;
    const timed = async (work: () => Promise<unknown>): Promise<number> => {
      const started = performance.now();

      await work();

      return Math.round(performance.now() - started);
    };
    const sendMs = await timed(async () => {
      for (let index = 0; index < count; index += 1) {
        await send(alice, sent('alice', mid('alice', `bench-${index}`)));
      }
    });
    const receiveMs = await timed(() => sync(bob));
    const store = new GroupMessageHistoryStore(bob.history);
    let page: DirectMessageRecord[] = [];
    const coldMs = await timed(async () => {
      page = await store.load(bob.session, CONVERSATION, count);
    });
    const decrypt = jest.spyOn(crypto.subtle, 'decrypt');
    const warmMs = await timed(() =>
      store.load(bob.session, CONVERSATION, count),
    );

    expect(bob.received).toHaveLength(count);
    expect(page).toHaveLength(count);
    expect(decrypt).not.toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.info('Group 500-message page (ms)', {
      coldHistoryPage: coldMs,
      receive: receiveMs,
      send: sendMs,
      warmHistoryPage: warmMs,
    });
    decrypt.mockRestore();
  }, 300_000);
});
