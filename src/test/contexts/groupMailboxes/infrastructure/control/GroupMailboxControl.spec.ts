import 'fake-indexeddb/auto';
import { sha256 } from '@noble/hashes/sha2.js';
import { mock } from 'jest-mock-extended';

import type { GroupMailboxControlOutcome } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlOutcome';
import type { GroupMailboxOutboxRow } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxRow';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';

import { generateMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';
import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxKeyPackageTimeoutError } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxKeyPackageTimeoutError';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { GroupMailboxOutbox } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutbox';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';
import { MlsTestIdentity } from '../../../communities/infrastructure/mls/MlsTestIdentity';
import { sealedGroupStores } from '../sealedGroupStores';

const CONVERSATION = 'conversation-1';

type DirectRecord = { from: string; plaintext: Uint8Array };

type Member = {
  control: GroupMailboxControl;
  engine: GroupMailboxMlsEngine;
  id: string;
  inbox: DirectRecord[];
  name: string;
};

let cast: Record<string, MlsTestIdentity>;
let roster = GroupMailboxRoster.empty();
let database = 0;

const id = (name: string): string => cast[name].id;

/** The roster of a conversation alice created and alone manages. */
const rosterOf = (names: string[]): GroupMailboxRoster =>
  GroupMailboxRoster.of({
    adminIds: [],
    creatorId: id('alice'),
    participantIds: names.map(id),
  });

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
/** The first device of each identity, by identity id. */
let members: Map<string, Member>;
/** Every device; a letter reaches every device of its recipient. */
let devices: Member[];

/** An outbox over `channel` whose rows live in memory. */
const outboxOf = (
  identityId: string,
  engine: GroupMailboxMlsEngine,
  channel: Pick<MailboxChannel, 'send'>,
): GroupMailboxOutbox => {
  const rows = new Map<string, GroupMailboxOutboxRow>();

  return new GroupMailboxOutbox(
    { identity: { id: identityId } } as unknown as Session,
    engine,
    channel,
    {
      forget: () => Promise.resolve(rows.clear()),
      load: () => Promise.resolve([...rows.values()]),
      remove: (_identityId, rowId) => Promise.resolve(void rows.delete(rowId)),
      save: (_session, row) => Promise.resolve(void rows.set(row.id, row)),
    },
    () => Promise.resolve(roster),
    () => 1_000,
  );
};

/** A device of `name` that reads the roster through `rosterView`. */
const engineOf = (
  name: string,
  device = 'd1',
  rosterView = (): GroupMailboxRoster => roster,
): GroupMailboxMlsEngine => {
  const databaseName = `group-control-${++database}`;
  const stores = sealedGroupStores(databaseName, id(name));

  return new GroupMailboxMlsEngine(
    cast[name].signer(device),
    stores.state,
    stores.generations,
    () => Promise.resolve(rosterView()),
    () => 1_000,
  );
};

const member = (name: string, device = 'd1'): Member => {
  const engine = engineOf(name, device);
  const created: Member = {
    control: new GroupMailboxControl(
      cast[name].owner(device),
      engine,
      () => Promise.resolve(roster),
      {
        send: (conversationId, peerIdentityId, plaintext) => {
          if (conversationId !== CONVERSATION) {
            return Promise.reject(new Error('letter for another conversation'));
          }
          for (const recipient of devices) {
            if (recipient.id === peerIdentityId) {
              recipient.inbox.push({ from: id(name), plaintext });
            }
          }

          return Promise.resolve();
        },
      },
      outboxOf(id(name), engine, node.channel),
    ),
    engine,
    id: id(name),
    inbox: [],
    name,
  };

  devices.push(created);

  if (device === 'd1') members.set(created.id, created);

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
    IdentityId.fromString(owner.id),
  );

/**
 * Creates `I(Y,k)` for every member, `k` being the generation of `inviter`,
 * as each member's own sync will once it holds that generation.
 */
const openInboxes = async (inviter: Member): Promise<void> => {
  for (const identityId of await inviter.engine.members(CONVERSATION)) {
    const owner = members.get(identityId);

    if (!owner) throw new Error('unknown member');
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
    joiners.map((joiner) => joiner.id),
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

/**
 * Bob, already a member, adds his laptop: the laptop alone answers the key
 * package request his identity receives, and joins from the welcome.
 */
const addLaptop = async (bob: Member): Promise<Member> => {
  const laptop = member('bob', 'd2');
  const adding = bob.control.addDevices(CONVERSATION, [
    cast.bob.deviceCredential('d2'),
  ]);

  await until(() => laptop.inbox.length > 0);
  // Bob's identity gets its own request; only the device it names answers.
  await expect(drain(bob)).resolves.toEqual(['ignored']);
  await expect(drain(laptop)).resolves.toEqual(['applied', 'ignored']);
  await expect(drain(bob)).resolves.toEqual(['applied']);
  await adding;
  await expect(drain(laptop)).resolves.toEqual(['applied']);
  // The welcome reaches bob too, who already holds the group.
  await expect(drain(bob)).resolves.toEqual(['rejected']);

  return laptop;
};

describe('GroupMailboxControl on the real ts-mls library', () => {
  let alice: Member;
  let bob: Member;
  let carol: Member;
  let mallory: Member;

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['alice', 'bob', 'carol', 'mallory']);
  });

  beforeEach(async () => {
    roster = rosterOf(['alice', 'bob', 'carol']);
    node = fakeNode();
    members = new Map();
    devices = [];
    alice = member('alice');
    bob = member('bob');
    carol = member('carol');
    mallory = member('mallory');
    await alice.engine.createGroup(CONVERSATION);
    await openInboxes(alice);
  });

  afterEach(() => {
    for (const { control } of devices) control.close();
  });

  it('adds a roster member from its key package and a welcome', async () => {
    await add(alice, [bob]);

    await expect(drain(bob)).resolves.toEqual(['applied']);
    await sameGeneration(alice, bob);
    await expect(bob.engine.members(CONVERSATION)).resolves.toEqual(
      [alice.id, bob.id].sort(),
    );
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

    await alice.control.remove(CONVERSATION, [carol.id]);

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

  it('delivers a removal whose envelope id the removed member squatted', async () => {
    await add(alice, [bob, carol]);
    await Promise.all([drain(bob), drain(carol)]);
    await openInboxes(alice);
    const bobKeys = await inboxKeys(bob, carol);
    const { epoch } = await carol.engine.generation(CONVERSATION);

    await node.channel.send(
      bobKeys,
      GroupMailboxControlRecord.encode({
        commit: new Uint8Array([1, 2, 3]),
        conversationId: CONVERSATION,
        type: 'commit',
      }),
      MailboxChannel.envelopeIdFor(
        `group-commit|${epoch.toString()}|${bobKeys.mailboxId}`,
      ),
    );

    await alice.control.remove(CONVERSATION, [carol.id]);

    await expect(readGroup(bob)).resolves.toEqual(['rejected', 'applied']);
    await sameGeneration(alice, bob);
  });

  it('delivers a removal whose first copy the removed member saw before the rest', async () => {
    await add(alice, [bob, carol]);
    await Promise.all([drain(bob), drain(carol)]);
    await openInboxes(alice);
    const bobKeys = await inboxKeys(bob, carol);
    let squatted: Promise<void> | undefined;
    const racing = new GroupMailboxControl(
      cast.alice.owner(),
      alice.engine,
      () => Promise.resolve(roster),
      { send: () => Promise.resolve() },
      outboxOf(alice.id, alice.engine, {
        send: async (keys, plaintext, envelopeId) => {
          const record = GroupMailboxControlRecord.decode(plaintext);

          // The removed member squats bob's id as soon as it sees a copy.
          if (record?.type === 'commit') {
            squatted ??= node.channel
              .send(
                bobKeys,
                GroupMailboxControlRecord.encode({
                  ...record,
                  commit: new Uint8Array([1, 2, 3]),
                }),
                MailboxChannel.envelopeIdFor(
                  `group-commit|${encodeBase64Url(sha256(record.commit))}|${bobKeys.mailboxId}`,
                ),
              )
              .then(() => undefined);
            await squatted;
          }

          return node.channel.send(keys, plaintext, envelopeId);
        },
      }),
    );

    await racing.remove(CONVERSATION, [carol.id]);

    await expect(readGroup(bob)).resolves.toEqual(['rejected', 'applied']);
    await sameGeneration(alice, bob);
  });

  it('rejects a replayed welcome', async () => {
    await add(alice, [bob]);
    const [welcome] = bob.inbox;

    await drain(bob);
    const joined = await bob.engine.generation(CONVERSATION);

    await expect(
      bob.control.receiveDirect(alice.id, welcome.plaintext),
    ).resolves.toBe('rejected');
    expect(
      (await bob.engine.generation(CONVERSATION)).secret.isEqual(joined.secret),
    ).toBe(true);
  });

  it('rejects a welcome from outside the roster', async () => {
    await add(alice, [bob]);
    const [welcome] = bob.inbox;

    await expect(
      bob.control.receiveDirect(mallory.id, welcome.plaintext),
    ).resolves.toBe('rejected');
    await expect(bob.engine.members(CONVERSATION)).rejects.toThrow();
    await expect(
      bob.control.receiveDirect(alice.id, welcome.plaintext),
    ).resolves.toBe('applied');
  });

  it('rejects a welcome from a roster member the roster does not let add devices', async () => {
    // Carol may not add anyone; a patched client of hers forges a group anyway.
    const forger = engineOf('carol', 'd2', () =>
      GroupMailboxRoster.of({
        adminIds: [],
        participantIds: ['alice', 'bob', 'carol'].map(id),
      }),
    );
    await forger.createGroup(CONVERSATION);
    const forged = await forger.add(
      CONVERSATION,
      [await bob.engine.createKeyPackage()],
      () => Promise.resolve(),
    );

    await expect(
      bob.control.receiveDirect(
        carol.id,
        GroupMailboxControlRecord.encode({
          conversationId: CONVERSATION,
          index: forged.generation.index,
          type: 'welcome',
          welcome: forged.welcome!,
        }),
      ),
    ).resolves.toBe('rejected');
    await expect(bob.engine.members(CONVERSATION)).rejects.toThrow();
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

    await expect(bob.control.receiveDirect(mallory.id, request)).resolves.toBe(
      'ignored',
    );
    expect(mallory.inbox).toEqual([]);
    roster = rosterOf(['alice', 'carol', 'mallory']);
    await expect(bob.control.receiveDirect(mallory.id, request)).resolves.toBe(
      'ignored',
    );
    expect(mallory.inbox).toEqual([]);
  });

  it('ignores key packages nobody asked that peer for', async () => {
    const adding = alice.control.add(CONVERSATION, [bob.id]);

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
      alice.control.receiveDirect(carol.id, unsolicited),
    ).resolves.toBe('ignored');
    await drain(bob);
    await drain(alice);
    await adding;
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual(
      [alice.id, bob.id].sort(),
    );
  });

  it("rejects a key package that is not the answering peer's", async () => {
    const adding = alice.control.add(CONVERSATION, [bob.id]);

    await until(() => bob.inbox.length > 0);
    const request = GroupMailboxControlRecord.decode(bob.inbox[0].plaintext);

    if (request?.type !== 'key-package-request') {
      throw new Error('expected a key package request');
    }

    await expect(
      alice.control.receiveDirect(
        bob.id,
        GroupMailboxControlRecord.encode({
          conversationId: CONVERSATION,
          keyPackage: await carol.engine.createKeyPackage(),
          requestId: request.requestId,
          type: 'key-package-response',
        }),
      ),
    ).resolves.toBe('rejected');
    await expect(adding).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual([
      alice.id,
    ]);
    expect(carol.inbox).toEqual([]);
  });

  it('rejects a key package another key made in the name of the answering peer', async () => {
    const adding = alice.control.add(CONVERSATION, [bob.id]);

    await until(() => bob.inbox.length > 0);
    const request = GroupMailboxControlRecord.decode(bob.inbox[0].plaintext);

    if (request?.type !== 'key-package-request') {
      throw new Error('expected a key package request');
    }
    // Mallory holds the leaf key and claims it is a device of bob.
    const forged = await generateMlsKeyPackage(
      new MlsLeafSigner(
        cast.bob.owner('d9'),
        cast.mallory.keyPair,
        cast.bob.deviceKeyPair('d9'),
      ),
    );

    await expect(
      alice.control.receiveDirect(
        bob.id,
        GroupMailboxControlRecord.encode({
          conversationId: CONVERSATION,
          keyPackage: forged.publicBytes,
          requestId: request.requestId,
          type: 'key-package-response',
        }),
      ),
    ).resolves.toBe('rejected');
    await expect(adding).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual([
      alice.id,
    ]);
  });

  it('refuses to add an identity outside the roster', async () => {
    await expect(alice.control.add(CONVERSATION, [mallory.id])).rejects.toThrow(
      'Only roster members can be added',
    );
    expect(mallory.inbox).toEqual([]);
  });

  it('rejects the add of a peer that never answers once closed', async () => {
    const adding = alice.control.add(CONVERSATION, [bob.id]);

    await until(() => bob.inbox.length > 0);
    alice.control.close();

    await expect(adding).rejects.toBeInstanceOf(
      GroupMailboxKeyPackageTimeoutError,
    );
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual([
      alice.id,
    ]);
  });

  it('adds another device of its own identity without a manager, through its own welcome', async () => {
    await add(alice, [bob]);
    await drain(bob);
    await openInboxes(alice);

    const laptop = await addLaptop(bob);

    await expect(readGroup(alice)).resolves.toEqual(['applied']);
    await sameGeneration(alice, laptop);
    await sameGeneration(bob, laptop);
    await expect(laptop.engine.devices(CONVERSATION)).resolves.toEqual(
      [cast.bob.deviceCredential('d1'), cast.bob.deviceCredential('d2')].sort(),
    );
    await expect(alice.engine.members(CONVERSATION)).resolves.toEqual(
      [alice.id, bob.id].sort(),
    );
  });

  it('removes a revoked device of its own identity from the remaining members', async () => {
    await add(alice, [bob]);
    await drain(bob);
    await openInboxes(alice);
    const laptop = await addLaptop(bob);
    await readGroup(alice);
    await openInboxes(alice);

    await bob.control.removeDevices(CONVERSATION, [
      cast.bob.deviceCredential('d2'),
    ]);

    await expect(readGroup(alice)).resolves.toEqual(['applied']);
    await sameGeneration(alice, bob);
    await expect(bob.engine.devices(CONVERSATION)).resolves.toEqual([
      cast.bob.deviceCredential('d1'),
    ]);
    expect(
      (await laptop.engine.generation(CONVERSATION)).secret.isEqual(
        (await alice.engine.generation(CONVERSATION)).secret,
      ),
    ).toBe(false);
  });

  it('ignores a request of its own identity that names another device, or once it holds a leaf', async () => {
    const request = (deviceCredential?: string) =>
      GroupMailboxControlRecord.encode({
        conversationId: CONVERSATION,
        ...(deviceCredential === undefined ? {} : { deviceCredential }),
        requestId: MailboxChannel.randomEnvelopeId(),
        type: 'key-package-request',
      });

    for (const [peer, named] of [
      [bob.id, cast.bob.deviceCredential('d3')],
      [bob.id, undefined],
      [alice.id, cast.bob.deviceCredential('d3')],
    ] as const) {
      await expect(
        bob.control.receiveDirect(peer, request(named)),
      ).resolves.toBe('ignored');
    }
    await add(alice, [bob]);
    await drain(bob);
    await expect(
      bob.control.receiveDirect(
        bob.id,
        request(cast.bob.deviceCredential('d1')),
      ),
    ).resolves.toBe('ignored');
    expect(bob.inbox).toEqual([]);
    expect(alice.inbox).toEqual([]);
  });

  it('rejects a key package of another device than the one it asked its identity for', async () => {
    await add(alice, [bob]);
    await drain(bob);
    const adding = bob.control.addDevices(CONVERSATION, [
      cast.bob.deviceCredential('d2'),
    ]);

    await until(() => bob.inbox.length > 0);
    const request = GroupMailboxControlRecord.decode(bob.inbox[0].plaintext);

    if (request?.type !== 'key-package-request') {
      throw new Error('expected a key package request');
    }
    expect(request.deviceCredential).toBe(cast.bob.deviceCredential('d2'));

    await expect(
      bob.control.receiveDirect(
        bob.id,
        GroupMailboxControlRecord.encode({
          conversationId: CONVERSATION,
          keyPackage: await engineOf('bob', 'd3').createKeyPackage(),
          requestId: request.requestId,
          type: 'key-package-response',
        }),
      ),
    ).resolves.toBe('rejected');
    await expect(adding).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(bob.engine.devices(CONVERSATION)).resolves.toEqual([
      cast.bob.deviceCredential('d1'),
    ]);
  });
});
