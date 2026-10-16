import 'fake-indexeddb/auto';
import type { MockProxy } from 'jest-mock-extended';

import {
  BearerCapability,
  KeyPair,
  MailboxReadToken,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationSyncOutcome } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationSyncOutcome';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { MessageAttachmentPublisher } from '../../../../contexts/messages/infrastructure/http/MessageAttachmentPublisher';
import type { PigeonLinkPreviewsApi } from '../../../../contexts/messages/infrastructure/http/PigeonLinkPreviewsApi';
import type { NotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { GroupMailboxControlSeal } from '../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlSeal';
import { GroupConversationMailbox } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import { GroupMessageHistoryStore } from '../../../../contexts/groupMailboxes/infrastructure/history/GroupMessageHistoryStore';
import { GroupMailboxOutbox } from '../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutbox';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { sessionRootKey } from '../../../../contexts/identities/infrastructure/session/sessionRootKey';
import { MailboxUnavailableError } from '../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxChannel } from '../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { MessageProjector } from '../../../../contexts/messages/infrastructure/crypto/MessageProjector';
import { PigeonMessageCommandsApi } from '../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { DirectMessageReaderSet } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { copy } from '../../../../shared/presentation/i18n/copy';

const databaseNames = async (): Promise<string[]> =>
  (await indexedDB.databases()).map(({ name }) => name ?? '');

const mlsDatabaseOf = async (member: { id: string }): Promise<string> =>
  (await databaseNames()).find((name) => name.endsWith(`-mls-${member.id}`)) ??
  '';

const openDatabase = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve) => {
    const request = indexedDB.open(name);

    request.addEventListener('success', () => resolve(request.result));
  });

type Member = {
  changes: DirectMessageTimelineChange[];
  id: string;
  /** A second device's own local storage; the first devices share one. */
  local?: Map<string, string>;
  mailbox: GroupConversationMailbox;
  session: Session;
  storage: string;
};

const NETWORK = 'network-1';
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA';
const NOW = 1_700_000_000_000;

let devices = 0;
/** The group id alice creates: the hash of `genesis()`. */
let CONVERSATION: string;
let now = NOW;
let letters: Map<string, NotificationResource[]>;
/** The device credentials the node lists for each identity. */
let listed: Map<string, string[]>;
/** The device credentials each identity's signed transitions authorize. */
let verified: Map<string, string[]>;
let local: Map<string, string>;
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
let alice: Member;
let bob: Member;
let carol: Member;
/** Bob's second device, when a test adds one. */
let laptop: Member | undefined;

/** Group inboxes on a node: appends idempotent, reads need a reader. */
const fakeMailboxes = (): void => {
  inboxes = new Map();
  wire = mock<PigeonMailboxClient>();
  const readable = (mailboxId: string, token: string) => {
    const inbox = inboxes.get(mailboxId);

    if (!inbox?.readers.has(BearerCapability.hash(token))) {
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
  wire.readers.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => ({
      maxReaders: 16,
      readers: [...readable(mailboxId, token).readers].map((readTokenHash) => ({
        ackedCursor: 0,
        readTokenHash,
      })),
    })),
  );
  wire.removeReader.mockImplementation((mailboxId, token, readTokenHash) =>
    Promise.resolve().then(() => {
      readable(mailboxId, token).readers.delete(readTokenHash);
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

      return { envelopes: unread.slice(0, limit), hasMore: false };
    }),
  );
  wire.acknowledge.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => {
      readable(mailboxId, token);
    }),
  );
  wire.delete.mockImplementation((mailboxId, token) =>
    Promise.resolve().then(() => {
      if (inboxes.get(mailboxId)?.root !== BearerCapability.hash(token)) {
        throw new MailboxUnavailableError();
      }
      inboxes.delete(mailboxId);
    }),
  );
  channel = new MailboxChannel(wire, () => Promise.resolve('nonce'));
};

const memoryStorage = (): void => {
  local = new Map();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => local.get(key) ?? null,
      removeItem: (key: string) => local.delete(key),
      setItem: (key: string, value: string) => local.set(key, value),
    },
  });
};

/** A control letter as the node stores it: a sealed group notification. */
const post = (
  from: Session,
  conversationId: string,
  peer: string,
  plaintext: Uint8Array,
): Promise<void> => {
  const inbox = letters.get(peer) ?? [];
  const id = `n${String(inbox.length + 1).padStart(6, '0')}`;
  const sealed = GroupMailboxControlSeal.seal(from, {
    conversationId,
    plaintext,
    recipientIdentityId: peer,
    sentAt: NOW,
  });

  inbox.unshift({
    id,
    payload: {
      encryptedConversationKey: sealed,
      inviterIdentityId: from.identity.id,
      nonce: 'nonce',
      recipientIdentityId: peer,
    },
    recipientIdentityId: peer,
    state: 'pending',
    status: 'unread',
    type: 'group_conversation_invitation',
  });
  letters.set(peer, inbox);

  return Promise.resolve();
};

const composer = (): PigeonMessageCommandsApi => {
  const attachments = mock<MessageAttachmentPublisher>();
  const mutations = mock<PublicMutationSigner>();

  attachments.publishMessageAttachments.mockResolvedValue([]);
  mutations.authorOf.mockImplementation((session) => session.identity.id);

  return new PigeonMessageCommandsApi(
    mock<PigeonLinkPreviewsApi>(),
    attachments,
    mutations,
  );
};

const device = (storage: string): GroupConversationMailbox =>
  new GroupConversationMailbox({
    channel,
    client: wire,
    composer: composer(),
    contacts: () => [...contacts],
    direct: (from) => ({
      send: (conversationId, peer, plaintext) =>
        post(from, conversationId, peer, plaintext),
    }),
    notifications: {
      listPage: (owner, limit, before) =>
        Promise.resolve(
          (letters.get(owner.identity.id) ?? [])
            .filter(({ id }) => before === undefined || id < before)
            .slice(0, limit),
        ),
      /** Like the node: the first resolution of a notification stays. */
      update: (owner, notificationId, state) => {
        const inbox = letters.get(owner.identity.id) ?? [];
        const index = inbox.findIndex(({ id }) => id === notificationId);

        if (index < 0) return Promise.reject(new Error('Not found'));

        if (inbox[index].state === 'pending') {
          inbox[index] = { ...inbox[index], state };
        }

        return Promise.resolve(inbox[index]);
      },
    },
    now: () => now,
    projector: new MessageProjector(copy.messages),
    readerSet: new DirectMessageReaderSet(channel, (owner) =>
      Promise.resolve(listed.get(owner.identity.id) ?? []),
    ),
    storage,
    verifiedDevices: (owner) =>
      Promise.resolve(verified.get(owner.identity.id) ?? []),
  });

/** A new identity's first device, or another device of `of`'s identity. */
const person = async (of?: Member): Promise<Member> => {
  const keyPair = of ? of.session.keyPair : await KeyPair.generate();
  const deviceKeyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();
  const seed = ++devices;
  const session = {
    deviceCredentialKeyPair: deviceKeyPair,
    deviceId: `device-${seed}`,
    deviceSealedRootKey: of
      ? of.session.deviceSealedRootKey
      : SymmetricKey.fromBuffer(Buffer.alloc(32, seed)),
    identity: { id },
    keychain: { conversations: [] },
    keyPair,
  } as unknown as Session;

  contacts.add(id);
  for (const devicesOf of [listed, verified]) {
    devicesOf.set(id, [
      ...(devicesOf.get(id) ?? []),
      deviceKeyPair.toPrimitives().publicKey,
    ]);
  }

  return {
    changes: [],
    id,
    local: of ? new Map() : undefined,
    mailbox: device(`group-conversation-${seed}`),
    session,
    storage: `group-conversation-${seed}`,
  };
};

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Lets every member read its control letters until `work` settles. */
const settle = async <T>(work: Promise<T>, everyone: Member[]): Promise<T> => {
  let done = false;
  const finished = work.finally(() => {
    done = true;
  });

  for (let round = 0; round < 400 && !done; round += 1) {
    for (const member of everyone) {
      await member.mailbox.receiveControl(member.session);
    }
    await turn();
  }

  return await finished;
};

const conversation = (): ConversationResource =>
  ({ id: CONVERSATION, type: 'group' }) as unknown as ConversationResource;

/**
 * Reads the conversation's inboxes. A second device reads on its own local
 * storage, so nothing else may run meanwhile.
 */
const sync = async (member: Member): Promise<GroupConversationSyncOutcome> => {
  const shared = local;

  local = member.local ?? shared;

  try {
    return await member.mailbox.sync(
      member.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => member.changes.push(...changes),
    );
  } finally {
    local = shared;
  }
};

const texts = (member: Member): string[] =>
  member.changes.flatMap((change) =>
    change.kind === 'message' || change.kind === 'edit'
      ? [`${change.kind}:${change.message.content}`]
      : [],
  );

const everyone = (): Member[] => [alice, bob, carol];

/** Every identity is a contact of every other here. */
let contacts: Set<string>;

/**
 * Every member reads its inboxes twice: the first pass applies pending
 * commits, the second opens the inboxes of the epoch they lead to. A sender
 * can only post to an inbox its owner has opened.
 */
const catchUp = async (members: Member[] = everyone()): Promise<void> => {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const member of members) await sync(member);
  }
};

/**
 * The three of them in one group, each joined from its welcome. Bob answers
 * first and opens his inboxes before carol answers: the commit that adds
 * carol can only reach an inbox bob has opened.
 */
const formGroup = async (): Promise<void> => {
  CONVERSATION = (
    await alice.mailbox.create(alice.session, {
      name: 'Group',
      networkId: NETWORK,
      participantIds: [bob.id, carol.id],
    })
  ).id;
  await settle(alice.mailbox.membersChanged(alice.session, CONVERSATION), [
    alice,
    bob,
  ]);
  await settle(Promise.resolve(), [alice, bob]);
  await catchUp([alice, bob]);
  await settle(Promise.resolve(), everyone());
  await settle(Promise.resolve(), everyone());
  await catchUp();
};

/**
 * The group, then a second device of bob's that bob's first device adds,
 * every device having read the commit and opened its next inboxes.
 */
const formGroupWithLaptop = async (): Promise<Member> => {
  await formGroup();
  const added = await person(bob);
  const all = [...everyone(), added];

  laptop = added;
  await settle(bob.mailbox.membersChanged(bob.session, CONVERSATION), all);
  await settle(Promise.resolve(), all);
  await catchUp(all);

  return added;
};

beforeEach(async () => {
  fakeMailboxes();
  memoryStorage();
  letters = new Map();
  listed = new Map();
  verified = new Map();
  now = NOW;
  contacts = new Set();
  laptop = undefined;
  [alice, bob, carol] = await Promise.all([person(), person(), person()]);
  CONVERSATION = new ConversationIdFactory()
    .createGroup(
      ConversationParticipantId.fromString(alice.id),
      ConversationNetworkId.fromString(NETWORK),
      ConversationGroupNonce.fromString(NONCE),
    )
    .toString();
});

afterEach(() => {
  for (const member of [...everyone(), ...(laptop ? [laptop] : [])]) {
    member.mailbox.stop(member.id);
  }
});

describe('GroupConversationMailbox', () => {
  it('delivers a message to every member and keeps the sender’s copy', async () => {
    await formGroup();

    await alice.mailbox.send(alice.session, conversation(), 'hello group', {});
    await Promise.all(everyone().map(sync));
    const own: DirectMessageTimelineChange[] = [];

    await alice.mailbox.restore(
      alice.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => own.push(...changes),
    );

    expect(texts(bob)).toEqual(['message:hello group']);
    expect(texts(carol)).toEqual(['message:hello group']);
    expect(texts({ ...alice, changes: own })).toEqual(['message:hello group']);
  });

  it('keeps plaintext off the node', async () => {
    await formGroup();

    await alice.mailbox.send(alice.session, conversation(), 'secret-4c1f', {});

    const bodies = [...inboxes.values()].flatMap(({ envelopes }) =>
      envelopes.map(({ body }) => body),
    );

    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.join('\n')).not.toContain('secret-4c1f');
  });

  it('a removed member cannot read messages sent after removal', async () => {
    await formGroup();
    await alice.mailbox.removeMember(alice.session, CONVERSATION, carol.id);

    await settle(
      Promise.all(
        everyone().map((member) =>
          member.mailbox.membersChanged(member.session, CONVERSATION),
        ),
      ),
      everyone(),
    );
    await catchUp();
    await bob.mailbox.send(bob.session, conversation(), 'after removal', {});
    await Promise.all(everyone().map(sync));

    expect(texts(alice)).toEqual(['message:after removal']);
    expect(texts(carol)).toEqual([]);
  });

  it('leaves the state of messages that are not this identity’s group records', async () => {
    await formGroup();
    const message = await alice.mailbox.send(
      alice.session,
      conversation(),
      'hello',
      {},
    );
    const messages = [
      { ...message, deliveryStatus: 'pending' as const, id: 'pending:1' },
      { ...message, deliveryStatus: 'failed' as const, id: 'pending:2' },
    ];

    expect(
      alice.mailbox.withOutboxState(alice.session, CONVERSATION, messages),
    ).toBe(messages);
    expect(
      bob.mailbox.withOutboxState(bob.session, CONVERSATION, [
        { ...message, deliveryStatus: 'pending' },
      ])[0].deliveryStatus,
    ).toBe('pending');
  });

  it('counts what arrives for a conversation not open, until it is read', async () => {
    await formGroup();
    const signal = new AbortController().signal;

    await alice.mailbox.send(alice.session, conversation(), 'first', {});
    await alice.mailbox.send(alice.session, conversation(), 'second', {});

    expect(
      await bob.mailbox.receive(bob.session, CONVERSATION, signal, () => {}),
    ).toEqual({ latestMessageAt: expect.any(Number), unreadCount: 2 });
    expect(
      (await alice.mailbox.activity(alice.session, CONVERSATION)).unreadCount,
    ).toBe(0);
    await bob.mailbox.markRead(bob.session, CONVERSATION);

    expect(
      (await bob.mailbox.activity(bob.session, CONVERSATION)).unreadCount,
    ).toBe(0);
    const restored: DirectMessageTimelineChange[] = [];

    await bob.mailbox.restore(bob.session, CONVERSATION, signal, (changes) =>
      restored.push(...changes),
    );

    expect(texts({ ...bob, changes: restored })).toEqual([
      'message:first',
      'message:second',
    ]);
  });

  it('restores what a background receive running at the same time brought in', async () => {
    await formGroup();
    const signal = new AbortController().signal;
    const restored: DirectMessageTimelineChange[] = [];

    await alice.mailbox.send(alice.session, conversation(), 'meanwhile', {});
    const receiving = bob.mailbox.receive(
      bob.session,
      CONVERSATION,
      signal,
      () => {},
    );

    await bob.mailbox.restore(bob.session, CONVERSATION, signal, (changes) =>
      restored.push(...changes),
    );
    await receiving;
    await sync(bob);

    expect([...texts({ ...bob, changes: restored }), ...texts(bob)]).toEqual([
      'message:meanwhile',
    ]);
  });

  it('rejects a send, edit, reaction or delete from an identity no longer on the roster', async () => {
    await formGroup();
    const own = await carol.mailbox.send(
      carol.session,
      conversation(),
      'before',
      {},
    );
    // Read before the removal: a removed leaf's late messages are not.
    await sync(alice);
    await alice.mailbox.removeMember(alice.session, CONVERSATION, carol.id);
    await sync(carol);
    const removed = 'This identity is not in the group';

    await expect(
      carol.mailbox.send(carol.session, conversation(), 'removed', {}),
    ).rejects.toThrow(removed);
    await expect(
      carol.mailbox.edit(carol.session, conversation(), own.id, 'later', {}),
    ).rejects.toThrow(removed);
    await expect(
      carol.mailbox.reaction(carol.session, conversation(), {
        action: 'add',
        emoji: '+1',
        messageId: own.id,
      }),
    ).rejects.toThrow(removed);
    await expect(
      carol.mailbox.delete(carol.session, conversation(), own.id),
    ).rejects.toThrow(removed);
    await catchUp([alice]);

    expect(texts(alice)).toEqual(['message:before']);
    expect(
      alice.changes.some(({ kind }) => kind === 'removed' || kind === 'edit'),
    ).toBe(false);
  });

  it('a leaver is removed by a remaining member on its next sync', async () => {
    await formGroup();
    await bob.mailbox.leave(bob.session, CONVERSATION);

    await settle(catchUp(), everyone());
    await settle(
      Promise.all([
        alice.mailbox.membersChanged(alice.session, CONVERSATION),
        carol.mailbox.membersChanged(carol.session, CONVERSATION),
      ]),
      everyone(),
    );
    await Promise.all(everyone().map(sync));
    await alice.mailbox.send(alice.session, conversation(), 'without bob', {});
    await Promise.all(everyone().map(sync));

    expect(texts(carol)).toEqual(['message:without bob']);
    expect(texts(bob)).toEqual([]);
  });

  it('reports the conversation a welcome joined, once', async () => {
    CONVERSATION = (
      await alice.mailbox.create(alice.session, {
        name: 'Group',
        networkId: NETWORK,
        participantIds: [bob.id],
      })
    ).id;
    const joined: string[] = [];

    // The add only asks bob; his answer and the welcome come back later.
    await alice.mailbox.membersChanged(alice.session, CONVERSATION);
    for (let round = 0; round < 400 && joined.length === 0; round += 1) {
      await alice.mailbox.receiveControl(alice.session);
      joined.push(...(await bob.mailbox.receiveControl(bob.session)));
      await turn();
    }
    joined.push(...(await bob.mailbox.receiveControl(bob.session)));

    expect(joined).toEqual([CONVERSATION]);
    expect(await alice.mailbox.receiveControl(alice.session)).toEqual([]);
  });

  // The e2e laptop/phone case: the device added sorts first among the
  // identity's leaves and never reads its control letters again, so only the
  // creator, which asked the member, may take the answer.
  it('welcomes a member who answers after the creator added its own other device', async () => {
    const sibling = await person(alice);
    const credential = (member: Member): string =>
      member.session.deviceCredentialKeyPair.toPrimitives().publicKey;
    // Leaves sort by credential as `GroupMailboxMlsEngine.devices` does.
    const [added, creator] =
      credential(alice) < credential(sibling)
        ? [alice, sibling]
        : [sibling, alice];

    contacts.delete(alice.id);
    CONVERSATION = (
      await creator.mailbox.create(creator.session, {
        name: 'Group',
        networkId: NETWORK,
        participantIds: [bob.id],
      })
    ).id;
    await settle(
      creator.mailbox.membersChanged(creator.session, CONVERSATION),
      [creator, added],
    );
    await bob.mailbox.receiveControl(bob.session);
    const [invitation] = bob.mailbox.invitations(bob.session);

    expect(
      await bob.mailbox.acceptInvitation(
        bob.session,
        invitation.notificationId,
      ),
    ).toBe(true);
    const joined: string[] = [];

    for (let round = 0; round < 50 && joined.length === 0; round += 1) {
      await creator.mailbox.receiveControl(creator.session);
      joined.push(...(await bob.mailbox.receiveControl(bob.session)));
      await turn();
    }

    expect(joined).toEqual([CONVERSATION]);
  });

  it('a sync tells a removed member it left the roster', async () => {
    await formGroup();
    await alice.mailbox.removeMember(alice.session, CONVERSATION, carol.id);

    await expect(sync(carol)).resolves.toEqual({
      removed: true,
      unconfirmed: false,
    });
    await expect(sync(bob)).resolves.toEqual({
      removed: false,
      unconfirmed: false,
    });
  });

  it('derives the group id from a fresh genesis naming its creator', async () => {
    const input = { name: ' Group ', networkId: NETWORK, participantIds: [] };
    const first = await alice.mailbox.create(alice.session, input);
    const second = await alice.mailbox.create(alice.session, input);

    expect(first.id).toMatch(/^group:[A-Za-z0-9_-]{43}$/);
    expect(second.id).not.toBe(first.id);
    expect(first).toEqual({
      adminIds: [],
      creatorId: alice.id,
      id: first.id,
      name: 'Group',
      networkId: NETWORK,
      participantIds: [alice.id],
      type: 'group',
    });
  });

  it('creates no group of more than 256 members', async () => {
    await expect(
      alice.mailbox.create(alice.session, {
        name: 'Group',
        networkId: NETWORK,
        participantIds: Array.from(
          { length: 256 },
          (_, index) => `member-${index}`,
        ),
      }),
    ).rejects.toThrow('The group cannot be created');
  });

  it('lists only the groups whose roster names this identity', async () => {
    await formGroup();
    await alice.mailbox.removeMember(alice.session, CONVERSATION, carol.id);
    await settle(catchUp(), everyone());

    expect(
      (await bob.mailbox.conversations(bob.session)).map(({ id }) => id),
    ).toEqual([CONVERSATION]);
    expect(await carol.mailbox.conversations(carol.session)).toEqual([]);
  });

  it('never calls the node’s group roster routes', async () => {
    const fetching = jest.spyOn(globalThis, 'fetch');

    try {
      await formGroup();
      await alice.mailbox.removeMember(alice.session, CONVERSATION, carol.id);
      await settle(catchUp(), everyone());

      expect(fetching).not.toHaveBeenCalled();
    } finally {
      fetching.mockRestore();
    }
  });

  it('holds what a member welcomed by a non-creator sends until the creator speaks', async () => {
    // The first committer by identity id adds the leaves: bob, once an admin.
    if (alice.id < bob.id) [alice, bob] = [bob, alice];
    await formGroup();
    const dave = await person();
    const all = [...everyone(), dave];

    try {
      await alice.mailbox.promote(alice.session, CONVERSATION, bob.id);
      await settle(catchUp(), all);
      // Everyone opens the inboxes the roster commit leads to before dave
      // answers: the commit adding dave can only reach an opened inbox.
      await bob.mailbox.addMember(bob.session, CONVERSATION, dave.id);
      await catchUp();
      await settle(bob.mailbox.membersChanged(bob.session, CONVERSATION), all);
      await settle(Promise.resolve(), all);
      await settle(Promise.resolve(), all);
      await catchUp(all);

      await expect(sync(dave)).resolves.toEqual({
        removed: false,
        unconfirmed: true,
      });
      await dave.mailbox.send(dave.session, conversation(), 'early', {});
      await catchUp(everyone());

      expect(texts(carol)).toEqual([]);

      await alice.mailbox.send(alice.session, conversation(), 'welcome', {});

      await expect(sync(dave)).resolves.toEqual({
        removed: false,
        unconfirmed: false,
      });
      await dave.mailbox.membersChanged(dave.session, CONVERSATION);
      await catchUp(everyone());

      expect(texts(dave)).toEqual(['message:welcome']);
      expect(texts(carol)).toEqual(['message:welcome', 'message:early']);
    } finally {
      dave.mailbox.stop(dave.id);
    }
  });

  it('rejects an edit or delete of another member’s message', async () => {
    await formGroup();
    const original = await carol.mailbox.send(
      carol.session,
      conversation(),
      'carol wrote this',
      {},
    );

    await bob.mailbox.edit(
      bob.session,
      conversation(),
      original.id,
      'bob rewrote it',
      {},
    );
    await bob.mailbox.delete(bob.session, conversation(), original.id);
    await sync(alice);

    expect(texts(alice)).toEqual(['message:carol wrote this']);
    expect(alice.changes.some(({ kind }) => kind === 'removed')).toBe(false);
  });

  it('applies an author’s own edit and delete', async () => {
    await formGroup();
    const original = await carol.mailbox.send(
      carol.session,
      conversation(),
      'first',
      {},
    );

    await carol.mailbox.edit(
      carol.session,
      conversation(),
      original.id,
      'second',
      {},
    );
    await carol.mailbox.delete(carol.session, conversation(), original.id);
    await sync(alice);

    expect(texts(alice)).toEqual(['message:first', 'edit:second']);
    expect(alice.changes).toContainEqual({
      kind: 'removed',
      messageId: original.id,
    });
  });

  it('carries a poll, its votes and its creator’s close to every member', async () => {
    await formGroup();
    const created = await alice.mailbox.createPoll(
      alice.session,
      conversation(),
      {
        allowsMultipleVotes: false,
        options: [
          { id: 'tea', text: 'Tea' },
          { id: 'coffee', text: 'Coffee' },
        ],
        question: 'Which one?',
      },
    );

    await Promise.all(everyone().map(sync));
    const pollId = created.kind === 'poll' ? created.id : '';
    const bobVote = await bob.mailbox.votePoll(
      bob.session,
      conversation(),
      pollId,
      ['coffee'],
    );
    const carolVote = await carol.mailbox.votePoll(
      carol.session,
      conversation(),
      pollId,
      [],
    );
    const closed = await alice.mailbox.closePoll(
      alice.session,
      conversation(),
      pollId,
    );

    await Promise.all(everyone().map(sync));
    const polls = (member: Member) =>
      member.changes.filter(({ kind }) => kind.startsWith('poll'));

    expect(created).toEqual({
      allowsMultipleVotes: false,
      createdAt: expect.any(Number),
      creatorIdentityId: alice.id,
      id: expect.any(String),
      kind: 'poll',
      options: [
        { id: 'tea', text: 'Tea' },
        { id: 'coffee', text: 'Coffee' },
      ],
      question: 'Which one?',
    });
    expect(bobVote).toEqual({
      createdAt: expect.any(Number),
      kind: 'poll_vote',
      optionIds: ['coffee'],
      pollId,
      voterIdentityId: bob.id,
    });
    expect(closed).toEqual({
      closerIdentityId: alice.id,
      createdAt: expect.any(Number),
      kind: 'poll_close',
      pollId,
    });
    expect(polls(carol)).toEqual(
      expect.arrayContaining([created, bobVote, closed]),
    );
    expect(polls(alice)).toEqual(expect.arrayContaining([bobVote, carolVote]));
  });

  it('refuses a poll the domain cannot hold before queuing it', async () => {
    await formGroup();

    await expect(
      alice.mailbox.createPoll(alice.session, conversation(), {
        allowsMultipleVotes: false,
        options: [{ id: 'tea', text: 'Tea' }],
        question: 'Which one?',
      }),
    ).rejects.toThrow();
    await Promise.all(everyone().map(sync));

    expect(bob.changes.some(({ kind }) => kind === 'poll')).toBe(false);
  });

  it('restores this member’s own poll from its history', async () => {
    await formGroup();
    const created = await alice.mailbox.createPoll(
      alice.session,
      conversation(),
      {
        allowsMultipleVotes: true,
        options: [
          { id: 'tea', text: 'Tea' },
          { id: 'coffee', text: 'Coffee' },
        ],
        question: 'Which ones?',
      },
    );
    const restored: DirectMessageTimelineChange[] = [];

    await alice.mailbox.restore(
      alice.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => restored.push(...changes),
    );

    expect(restored).toEqual([created]);
  });

  it('shows a member’s typing to the others, never in history or unread', async () => {
    await formGroup();
    const signal = new AbortController().signal;
    const typing = (member: Member) =>
      member.changes.filter(({ kind }) => kind === 'typing');
    const restored: DirectMessageTimelineChange[] = [];

    await alice.mailbox.typing(alice.session, CONVERSATION);
    await Promise.all(everyone().map(sync));
    await bob.mailbox.restore(bob.session, CONVERSATION, signal, (changes) =>
      restored.push(...changes),
    );

    expect(typing(bob)).toEqual([
      { createdAt: NOW, identityId: alice.id, kind: 'typing' },
    ]);
    expect(typing(carol)).toEqual(typing(bob));
    expect(typing(alice)).toEqual([]);
    expect(restored).toEqual([]);
    expect(
      (await bob.mailbox.activity(bob.session, CONVERSATION)).unreadCount,
    ).toBe(0);
  });

  it('sends a member’s typing at most once per 10 seconds', async () => {
    await formGroup();
    const typed = (member: Member) =>
      member.changes.flatMap((change) =>
        change.kind === 'typing' ? [change.createdAt] : [],
      );

    await alice.mailbox.typing(alice.session, CONVERSATION);
    now = NOW + 9_999;
    await alice.mailbox.typing(alice.session, CONVERSATION);
    await sync(bob);
    now = NOW + 10_000;
    await alice.mailbox.typing(alice.session, CONVERSATION);
    await sync(bob);

    expect(typed(bob)).toEqual([NOW, NOW + 10_000]);
  });

  it('tells the other members of an identity update, never in history or unread', async () => {
    await formGroup();
    const signal = new AbortController().signal;
    const updated = (member: Member) =>
      member.changes.filter(({ kind }) => kind === 'identity_updated');
    const restored: DirectMessageTimelineChange[] = [];

    await alice.mailbox.identityUpdated(alice.session, CONVERSATION);
    await Promise.all(everyone().map(sync));
    await bob.mailbox.restore(bob.session, CONVERSATION, signal, (changes) =>
      restored.push(...changes),
    );

    expect(updated(bob)).toEqual([
      { identityId: alice.id, kind: 'identity_updated' },
    ]);
    expect(updated(carol)).toEqual(updated(bob));
    expect(updated(alice)).toEqual([]);
    expect(restored).toEqual([]);
    expect(
      (await bob.mailbox.activity(bob.session, CONVERSATION)).unreadCount,
    ).toBe(0);
  });

  it('hands each identity update a background receive brings in to the caller', async () => {
    await formGroup();
    const signal = new AbortController().signal;
    const updated: string[] = [];

    await alice.mailbox.identityUpdated(alice.session, CONVERSATION);

    expect(
      await bob.mailbox.receive(bob.session, CONVERSATION, signal, (id) =>
        updated.push(id),
      ),
    ).toEqual({ latestMessageAt: undefined, unreadCount: 0 });
    expect(updated).toEqual([alice.id]);
  });

  it('ignores a replayed welcome after a restart', async () => {
    await formGroup();
    bob.mailbox.stop(bob.id);

    await bob.mailbox.receiveControl(bob.session);
    await alice.mailbox.send(alice.session, conversation(), 'still here', {});
    await sync(bob);

    expect(texts(bob)).toEqual(['message:still here']);
  });

  it('restores history after a restart without the node', async () => {
    await formGroup();
    await alice.mailbox.send(alice.session, conversation(), 'kept', {});
    await sync(bob);
    bob.mailbox.stop(bob.id);
    const restored: DirectMessageTimelineChange[] = [];

    await bob.mailbox.restore(
      bob.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => restored.push(...changes),
    );

    expect(restored).toEqual([
      expect.objectContaining({
        kind: 'message',
        message: expect.objectContaining({ content: 'kept' }),
      }),
    ]);
  });

  it('sends a queued message after a reload while the root is open', async () => {
    await formGroup();
    const offline = jest
      .spyOn(channel, 'send')
      .mockRejectedValue(new Error('offline'));

    await alice.mailbox.send(alice.session, conversation(), 'queued', {});
    alice.mailbox.stop(alice.id);
    offline.mockRestore();
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    alice.mailbox = device(alice.storage);
    await alice.mailbox.resume(alice.session);
    await sync(bob);

    expect(texts(bob)).toEqual(['message:queued']);
  });

  it('keeps the groups when another device of the identity is revoked', async () => {
    await formGroup();
    const rotated = {
      ...bob.session,
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 200)),
      previousDeviceSealedRootKey: bob.session.deviceSealedRootKey,
    } as unknown as Session;

    bob.session = rotated;
    await alice.mailbox.send(alice.session, conversation(), 'revoked', {});
    await sync(bob);
    bob.mailbox.stop(bob.id);
    bob.mailbox = device(bob.storage);
    bob.session = {
      ...rotated,
      previousDeviceSealedRootKey: undefined,
    } as unknown as Session;
    await bob.mailbox.send(bob.session, conversation(), 'still here', {});
    await sync(alice);
    await alice.mailbox.send(alice.session, conversation(), 'reloaded', {});
    await sync(bob);

    expect(texts(bob)).toEqual([
      'message:revoked',
      'message:still here',
      'message:reloaded',
    ]);
    expect(texts(alice)).toContain('message:still here');
  });

  it('cuts the replaced root off its own group inboxes after a revoke', async () => {
    await formGroup();
    const replacedRoot = sessionRootKey(bob.session);

    wire.read.mockClear();
    await sync(bob);
    const replaced = wire.read.mock.calls.flatMap(([mailboxId, token]) => [
      { mailboxId, token },
      { mailboxId, token: MailboxReadToken.derive(replacedRoot, mailboxId) },
    ]);

    bob.session = {
      ...bob.session,
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 200)),
      previousDeviceSealedRootKey: bob.session.deviceSealedRootKey,
    } as unknown as Session;
    await bob.mailbox.cutOffRevokedReaders(bob.session);
    await alice.mailbox.send(alice.session, conversation(), 'after', {});

    expect(replaced).not.toHaveLength(0);

    for (const { mailboxId, token } of replaced) {
      await expect(wire.read(mailboxId, token, 0, 50)).rejects.toThrow(
        MailboxUnavailableError,
      );
    }
    await sync(bob);

    expect(texts(bob)).toEqual(['message:after']);
  });

  it('adds a second device of a member, which reads the group', async () => {
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const second = await formGroupWithLaptop();

    await alice.mailbox.send(alice.session, conversation(), 'to both', {});
    await second.mailbox.send(
      second.session,
      conversation(),
      'from laptop',
      {},
    );
    for (const member of [...everyone(), second]) await sync(member);

    // Every sender also appends a copy to its own identity's inbox, for its
    // other devices. The laptop opens its copy from the plaintext it kept,
    // like the phone opens it, and its history holds the message once.
    // Alice's own copy waits behind her copy of the group's first commit,
    // sent before her first inbox existed and never retried here; her
    // history holds her message from the send.
    expect(texts(alice)).toEqual(['message:from laptop']);
    for (const member of [bob, carol, second]) {
      expect(texts(member).sort()).toEqual([
        'message:from laptop',
        'message:to both',
      ]);
    }
    const restored: DirectMessageTimelineChange[] = [];

    await second.mailbox.restore(
      second.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => restored.push(...changes),
    );
    expect(
      restored.filter(
        (change) =>
          change.kind === 'message' && change.message.content === 'from laptop',
      ),
    ).toHaveLength(1);
    expect(info).toHaveBeenCalledWith(
      'Group devices reconciled: removed 0, added 1.',
    );
    info.mockRestore();
  });

  it('never asks a device only the node lists for a key package', async () => {
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    await formGroup();
    const nodeOnly = (await KeyPair.generate()).toPrimitives().publicKey;
    const before = letters.get(bob.id)?.length ?? 0;

    listed.set(bob.id, [...(listed.get(bob.id) ?? []), nodeOnly]);
    await settle(
      bob.mailbox.membersChanged(bob.session, CONVERSATION),
      everyone(),
    );

    expect(letters.get(bob.id)?.length ?? 0).toBe(before);
    expect(info).not.toHaveBeenCalledWith(
      'Group devices reconciled: removed 0, added 1.',
    );
    info.mockRestore();
  });

  it('cuts a revoked device off what is sent after the revoke', async () => {
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const second = await formGroupWithLaptop();

    for (const devicesOf of [listed, verified]) {
      devicesOf.set(bob.id, [
        bob.session.deviceCredentialKeyPair.toPrimitives().publicKey,
      ]);
    }
    bob.session = {
      ...bob.session,
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 200)),
      previousDeviceSealedRootKey: bob.session.deviceSealedRootKey,
    } as unknown as Session;
    await bob.mailbox.cutOffRevokedReaders(bob.session);
    await settle(
      bob.mailbox.membersChanged(bob.session, CONVERSATION),
      everyone(),
    );
    await catchUp();
    await alice.mailbox.send(alice.session, conversation(), 'after', {});

    for (const member of everyone()) await sync(member);
    await sync(second).catch(() => undefined);

    expect(info).toHaveBeenCalledWith(
      'Group devices reconciled: removed 1, added 0.',
    );
    expect(texts(bob)).toEqual(['message:after']);
    expect(texts(second)).toEqual([]);

    bob.mailbox.stop(bob.id);
    bob.mailbox = device(bob.storage);
    bob.session = {
      ...bob.session,
      previousDeviceSealedRootKey: undefined,
    } as unknown as Session;
    await alice.mailbox.send(alice.session, conversation(), 'reloaded', {});
    await sync(bob);

    expect(texts(bob)).toEqual(['message:after', 'message:reloaded']);
    info.mockRestore();
  });

  it('drops the groups under a root it cannot trace back', async () => {
    await formGroup();
    bob.mailbox.stop(bob.id);
    bob.mailbox = device(bob.storage);
    bob.session = {
      ...bob.session,
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 201)),
    } as unknown as Session;

    await expect(
      bob.mailbox.send(bob.session, conversation(), 'no group', {}),
    ).rejects.toThrow();
  });

  it('forgets history and MLS state', async () => {
    await formGroup();
    await alice.mailbox.send(alice.session, conversation(), 'gone', {});
    await sync(bob);

    await bob.mailbox.forget(bob.id);
    const restored: DirectMessageTimelineChange[] = [];

    await bob.mailbox.restore(
      bob.session,
      CONVERSATION,
      new AbortController().signal,
      (changes) => restored.push(...changes),
    );

    expect(restored).toEqual([]);
    await expect(
      bob.mailbox.send(bob.session, conversation(), 'no group', {}),
    ).rejects.toThrow();
  });

  it('keeps a queued message sent when its local copy fails', async () => {
    await formGroup();
    const append = jest
      .spyOn(GroupMessageHistoryStore.prototype, 'append')
      .mockRejectedValueOnce(new Error('quota'));

    await expect(
      alice.mailbox.send(alice.session, conversation(), 'queued', {}),
    ).resolves.toEqual(expect.objectContaining({ content: 'queued' }));
    append.mockRestore();
    await sync(bob);

    expect(bob.changes).toContainEqual(
      expect.objectContaining({
        message: expect.objectContaining({ content: 'queued' }),
      }),
    );
  });

  it('erases the MLS state only once its open connections close', async () => {
    await formGroup();
    const name = await mlsDatabaseOf(bob);
    const open = await openDatabase(name);
    let erased = false;

    const forgetting = bob.mailbox.forget(bob.id).then(() => {
      erased = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(erased).toBe(false);
    open.close();
    await forgetting;

    expect(await databaseNames()).not.toContain(name);
  });

  it('rejects forget when a store fails, after erasing the others', async () => {
    await formGroup();
    const name = await mlsDatabaseOf(bob);
    const forget = jest
      .spyOn(GroupMessageHistoryStore.prototype, 'forget')
      .mockRejectedValueOnce(new Error('disk'));

    await expect(bob.mailbox.forget(bob.id)).rejects.toThrow();
    forget.mockRestore();

    expect(await databaseNames()).not.toContain(name);
  });

  it('erases the MLS state after a running membership update', async () => {
    await formGroup();
    const name = await mlsDatabaseOf(bob);
    const updating = bob.mailbox.membersChanged(bob.session, CONVERSATION);

    await bob.mailbox.forget(bob.id);
    await updating;

    expect(await databaseNames()).not.toContain(name);
  });
});
