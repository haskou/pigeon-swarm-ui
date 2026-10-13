import 'fake-indexeddb/auto';
import { mock } from 'jest-mock-extended';

import type { GroupMailboxControlOutcome } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlOutcome';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxKeyPackageTimeoutError } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxKeyPackageTimeoutError';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { IndexedDbGroupMailboxGenerationStore } from '../../../../../contexts/groupMailboxes/infrastructure/indexeddb/IndexedDbGroupMailboxGenerationStore';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';

const CONVERSATION = 'conversation-1';

type DirectRecord = { from: string; plaintext: Uint8Array };

type Member = {
  control: GroupMailboxControl;
  engine: GroupMailboxMlsEngine;
  inbox: DirectRecord[];
  name: string;
};

let roster: ReadonlySet<string> = new Set();
let database = 0;

type FakeNode = {
  channel: MailboxChannel;
  envelopes: (mailboxId: string) => number;
};

/**
 * A node holding the group inboxes. Appends need the inbox to exist and are
 * idempotent per envelope id; reads need the inbox's read token.
 */
const fakeNode = (): FakeNode => {
  type Inbox = {
    envelopes: { body: string; cursor: number; envelopeId: string }[];
    readTokenHash: string;
  };
  const inboxes = new Map<string, Inbox>();
  const wire = mock<PigeonMailboxClient>();

  wire.create.mockImplementation((mailboxId, creation) => {
    if (!inboxes.has(mailboxId)) {
      inboxes.set(mailboxId, {
        envelopes: [],
        readTokenHash: creation.readTokenHash,
      });
    }

    return Promise.resolve();
  });
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
  wire.read.mockImplementation((mailboxId, readToken, after, limit) => {
    const inbox = inboxes.get(mailboxId);

    if (inbox?.readTokenHash !== MailboxCapability.hash(readToken)) {
      return Promise.reject(new MailboxUnavailableError());
    }

    return Promise.resolve({
      envelopes: inbox.envelopes
        .filter(({ cursor }) => cursor > after)
        .slice(0, limit),
      hasMore: false,
    });
  });

  return {
    channel: new MailboxChannel(wire, () => Promise.resolve('nonce')),
    envelopes: (mailboxId) => inboxes.get(mailboxId)?.envelopes.length ?? 0,
  };
};

let node: FakeNode;
let members: Map<string, Member>;

const member = (name: string): Member => {
  const databaseName = `group-control-${++database}`;
  const engine = new GroupMailboxMlsEngine(
    { deviceId: 'd1', identityId: name },
    new IndexedDbMlsStateStore(`${databaseName}-mls`, name),
    new IndexedDbGroupMailboxGenerationStore(
      `${databaseName}-generations`,
      name,
    ),
    () => Promise.resolve(roster),
    () => 1_000,
  );
  const created: Member = {
    control: new GroupMailboxControl(
      name,
      engine,
      () => Promise.resolve(roster),
      {
        send: (peerIdentityId, plaintext) => {
          members.get(peerIdentityId)?.inbox.push({ from: name, plaintext });

          return Promise.resolve();
        },
      },
      node.channel,
    ),
    engine,
    inbox: [],
    name,
  };

  members.set(name, created);

  return created;
};

/** Lets pending promise chains run until `ready` holds. */
const until = async (ready: () => boolean): Promise<void> => {
  for (let turn = 0; turn < 200 && !ready(); turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(ready()).toBe(true);
};

/** Hands every record waiting in the 1:1 inbox of `to` to its control. */
const drain = async (to: Member): Promise<GroupMailboxControlOutcome[]> => {
  const outcomes: GroupMailboxControlOutcome[] = [];

  while (to.inbox.length > 0) {
    const { from, plaintext } = to.inbox.shift() as DirectRecord;

    outcomes.push(await to.control.receiveDirect(from, plaintext));
  }

  return outcomes;
};

const inboxKeys = async (owner: Member, of: Member = owner) =>
  GroupMailboxKeySchedule.inbox(
    (await of.engine.generation(CONVERSATION)).secret,
    IdentityId.fromString(owner.name),
  );

/**
 * Creates `I(Y,k)` for every member, `k` being the generation of `inviter`,
 * as each member's own sync will once it holds that generation.
 */
const openInboxes = async (inviter: Member): Promise<void> => {
  for (const name of await inviter.engine.members(CONVERSATION)) {
    const owner = members.get(name);

    if (!owner) throw new Error(`unknown member ${name}`);
    await node.channel.createInbox(
      await inboxKeys(owner, inviter),
      `read-${owner.name}`,
    );
  }
};

/** Reads `I(self,k)` of the current generation and applies its records. */
const readGroup = async (
  owner: Member,
): Promise<GroupMailboxControlOutcome[]> => {
  const token = `read-${owner.name}`;
  const page = await node.channel.read(
    await inboxKeys(owner),
    { device: token, root: token },
    0,
    100,
  );
  const outcomes: GroupMailboxControlOutcome[] = [];

  for (const { plaintext } of page.envelopes) {
    outcomes.push(await owner.control.receiveGroup(CONVERSATION, plaintext));
  }

  return outcomes;
};

/** `inviter` adds `joiners`; each answers its key package request. */
const add = async (inviter: Member, joiners: Member[]): Promise<void> => {
  await openInboxes(inviter);
  const adding = inviter.control.add(
    CONVERSATION,
    joiners.map(({ name }) => name),
  );

  await until(() => joiners.every(({ inbox }) => inbox.length > 0));
  for (const joiner of joiners) {
    await expect(drain(joiner)).resolves.toEqual(['applied']);
  }
  await until(() => inviter.inbox.length === joiners.length);
  await drain(inviter);
  await adding;
};

const sameGeneration = async (a: Member, b: Member): Promise<void> => {
  const [left, right] = await Promise.all([
    a.engine.generation(CONVERSATION),
    b.engine.generation(CONVERSATION),
  ]);

  expect(right.index).toBe(left.index);
  expect(right.secret.isEqual(left.secret)).toBe(true);
};

describe('GroupMailboxControl on the real ts-mls library', () => {
  let alice: Member;
  let bob: Member;
  let carol: Member;
  let mallory: Member;

  beforeEach(async () => {
    roster = new Set(['alice', 'bob', 'carol']);
    node = fakeNode();
    members = new Map();
    alice = member('alice');
    bob = member('bob');
    carol = member('carol');
    mallory = member('mallory');
    await alice.engine.createGroup(CONVERSATION);
    await openInboxes(alice);
  });

  afterEach(() => {
    for (const { control } of members.values()) control.close();
  });

  it('adds a roster member from its key package and a welcome', async () => {
    await add(alice, [bob]);

    await expect(drain(bob)).resolves.toEqual(['applied']);
    await sameGeneration(alice, bob);
    await expect(bob.engine.members(CONVERSATION)).resolves.toEqual([
      'alice',
      'bob',
    ]);
  });

  it('never puts the generation secret in a welcome', async () => {
    await add(alice, [bob]);
    const [{ plaintext }] = bob.inbox;
    const welcome = GroupMailboxControlRecord.decode(plaintext);
    const generation = await alice.engine.generation(CONVERSATION);

    expect(welcome).toMatchObject({ index: generation.index, type: 'welcome' });
    expect(new TextDecoder().decode(plaintext)).not.toContain(
      generation.secret.valueOf(),
    );
  });

  it('delivers an add commit to the inbox of every existing member', async () => {
    await add(alice, [bob]);
    await drain(bob);

    await add(alice, [carol]);

    await expect(readGroup(bob)).resolves.toEqual(['applied']);
    await expect(drain(carol)).resolves.toEqual(['applied']);
    await sameGeneration(alice, bob);
    await sameGeneration(alice, carol);
  });

  it('delivers a removal to the remaining members only', async () => {
    await add(alice, [bob, carol]);
    await Promise.all([drain(bob), drain(carol)]);
    await openInboxes(alice);
    const carolInbox = (await inboxKeys(carol)).mailboxId;

    await alice.control.remove(CONVERSATION, ['carol']);

    expect(node.envelopes(carolInbox)).toBe(0);
    await expect(readGroup(bob)).resolves.toEqual(['applied']);
    await sameGeneration(alice, bob);
    const carolGeneration = await carol.engine.generation(CONVERSATION);

    expect(
      carolGeneration.secret.isEqual(
        (await alice.engine.generation(CONVERSATION)).secret,
      ),
    ).toBe(false);
  });

  it('rejects a replayed welcome', async () => {
    await add(alice, [bob]);
    const [welcome] = bob.inbox;

    await drain(bob);
    const joined = await bob.engine.generation(CONVERSATION);

    await expect(
      bob.control.receiveDirect('alice', welcome.plaintext),
    ).resolves.toBe('rejected');
    expect(
      (await bob.engine.generation(CONVERSATION)).secret.isEqual(joined.secret),
    ).toBe(true);
  });

  it('rejects a welcome from outside the roster', async () => {
    await add(alice, [bob]);
    const [welcome] = bob.inbox;

    await expect(
      bob.control.receiveDirect('mallory', welcome.plaintext),
    ).resolves.toBe('rejected');
    await expect(bob.engine.members(CONVERSATION)).rejects.toThrow();
    await expect(
      bob.control.receiveDirect('alice', welcome.plaintext),
    ).resolves.toBe('applied');
  });

  it('rejects a forged commit and keeps the generation', async () => {
    await add(alice, [bob]);
    await drain(bob);
    const before = await bob.engine.generation(CONVERSATION);
    const { mailboxId } = await inboxKeys(bob);

    await add(alice, [carol]);
    const token = 'read-bob';
    const [envelope] = (
      await node.channel.read(
        await inboxKeys(bob),
        { device: token, root: token },
        0,
        10,
      )
    ).envelopes;
    const record = GroupMailboxControlRecord.decode(envelope.plaintext);

    if (record?.type !== 'commit') throw new Error('expected a commit');
    const forged = new Uint8Array(record.commit);

    forged[forged.length - 1] = forged[forged.length - 1] === 0 ? 1 : 0;

    await expect(
      bob.control.receiveGroup(
        CONVERSATION,
        GroupMailboxControlRecord.encode({ ...record, commit: forged }),
      ),
    ).resolves.toBe('rejected');
    expect(
      (await bob.engine.generation(CONVERSATION)).secret.isEqual(before.secret),
    ).toBe(true);
    expect(node.envelopes(mailboxId)).toBe(1);
    await expect(readGroup(bob)).resolves.toEqual(['applied']);
  });

  it('ignores a commit for another conversation', async () => {
    await add(alice, [bob]);

    await expect(
      bob.control.receiveGroup(
        'conversation-2',
        GroupMailboxControlRecord.encode({
          commit: new Uint8Array([1]),
          conversationId: CONVERSATION,
          type: 'commit',
        }),
      ),
    ).resolves.toBe('ignored');
  });

  it('answers key package requests from roster members only', async () => {
    const request = GroupMailboxControlRecord.encode({
      conversationId: CONVERSATION,
      requestId: MailboxChannel.randomEnvelopeId(),
      type: 'key-package-request',
    });

    await expect(bob.control.receiveDirect('mallory', request)).resolves.toBe(
      'ignored',
    );
    expect(mallory.inbox).toEqual([]);
    roster = new Set(['alice', 'carol', 'mallory']);
    await expect(bob.control.receiveDirect('mallory', request)).resolves.toBe(
      'ignored',
    );
    expect(mallory.inbox).toEqual([]);
  });

  it('ignores key packages nobody asked that peer for', async () => {
    const adding = alice.control.add(CONVERSATION, ['bob']);

    await until(() => bob.inbox.length > 0);
    const request = GroupMailboxControlRecord.decode(bob.inbox[0].plaintext);

    if (request?.type !== 'key-package-request') {
      throw new Error('expected a key package request');
    }
    const unsolicited = GroupMailboxControlRecord.encode({
      conversationId: CONVERSATION,
      keyPackage: await carol.engine.createKeyPackage(),
      requestId: request.requestId,
      type: 'key-package-response',
    });

    await expect(
      alice.control.receiveDirect('carol', unsolicited),
    ).resolves.toBe('ignored');
    await drain(bob);
    await drain(alice);
    await adding;
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual([
      'alice',
      'bob',
    ]);
  });

  it('refuses to add an identity outside the roster', async () => {
    await expect(alice.control.add(CONVERSATION, ['mallory'])).rejects.toThrow(
      'Only roster members can be added',
    );
    expect(mallory.inbox).toEqual([]);
  });

  it('rejects the add of a peer that never answers once closed', async () => {
    const adding = alice.control.add(CONVERSATION, ['bob']);

    await until(() => bob.inbox.length > 0);
    alice.control.close();

    await expect(adding).rejects.toBeInstanceOf(
      GroupMailboxKeyPackageTimeoutError,
    );
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual([
      'alice',
    ]);
  });
});
