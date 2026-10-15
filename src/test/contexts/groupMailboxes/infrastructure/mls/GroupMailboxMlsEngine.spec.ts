import 'fake-indexeddb/auto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxGenerationRepository } from '../../../../../contexts/groupMailboxes/domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxCommit } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxCommit';

import { generateMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';
import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxGenesis } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGenesis';
import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { GroupMailboxUnconfirmedError } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxUnconfirmedError';
import { MlsTestIdentity } from '../../../communities/infrastructure/mls/MlsTestIdentity';
import { sealedGroupStores } from '../sealedGroupStores';

const text = new TextEncoder();
const read = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const NETWORK = 'network-1';
const NONCE = 'nonce-1';
const NAMES = ['alice', 'bob', 'carol', 'dave'];
const sent = (): Promise<void> => Promise.resolve();

let cast: Record<string, MlsTestIdentity>;
/** The group alice created, its id derived from its genesis. */
let CONVERSATION = '';
let GENESIS: GroupMailboxGenesis;
let roster = GroupMailboxRoster.empty();
let clock = 0;
let database = 0;

const id = (name: string): string => cast[name].id;

/** Alice created the conversation and is its only manager. */
const managedByAlice = (): GroupMailboxRoster =>
  GroupMailboxRoster.of({
    adminIds: [],
    creatorId: id('alice'),
    participantIds: NAMES.map(id),
  });

/** A roster that names no manager lets every member add devices. */
const unmanaged = (): GroupMailboxRoster =>
  GroupMailboxRoster.of({ adminIds: [], participantIds: NAMES.map(id) });

/** The devices of an identity its signed transitions authorize: not d9. */
const CURRENT_DEVICES = ['d1', 'd2', 'd3', 'd4'];

const engine = (
  name: string,
  options: {
    databaseName?: string;
    device?: string;
    generations?: GroupMailboxGenerationRepository;
    rosterView?: () => GroupMailboxRoster;
    store?: MlsStateStore;
    /** The identities this engine's owner pinned as contacts, by id. */
    contacts?: () => readonly string[];
    /** The devices of its identity this engine verified, by name. */
    verified?: () => readonly string[];
  } = {},
): GroupMailboxMlsEngine => {
  const stores = sealedGroupStores(
    options.databaseName ?? `group-mls-${++database}`,
    id(name),
  );

  return new GroupMailboxMlsEngine(
    cast[name].signer(options.device),
    options.store ?? stores.state,
    options.generations ?? stores.generations,
    () => Promise.resolve(options.rosterView?.() ?? roster),
    () =>
      Promise.resolve(
        (options.verified?.() ?? CURRENT_DEVICES).map((device) =>
          cast[name].deviceCredential(device),
        ),
      ),
    () => options.contacts?.() ?? [],
    () => clock,
  );
};

/** The real store, whose writes a test can make fail once. */
const flakyStore = (
  databaseName: string,
  identityId: string,
): MockProxy<MlsStateStore> => {
  const backing = sealedGroupStores(databaseName, identityId).state;
  const store = mock<MlsStateStore>();

  store.deleteKeyPackage.mockImplementation((keyPackageId) =>
    backing.deleteKeyPackage(keyPackageId),
  );
  store.loadGroup.mockImplementation((groupId) => backing.loadGroup(groupId));
  store.loadKeyPackages.mockImplementation(() => backing.loadKeyPackages());
  store.loadPlaintext.mockImplementation((groupId, ciphertextId) =>
    backing.loadPlaintext(groupId, ciphertextId),
  );
  store.saveGroup.mockImplementation((groupId, state) =>
    backing.saveGroup(groupId, state),
  );
  store.saveKeyPackage.mockImplementation((keyPackage) =>
    backing.saveKeyPackage(keyPackage),
  );
  store.savePlaintext.mockImplementation((groupId, ciphertextId, plaintext) =>
    backing.savePlaintext(groupId, ciphertextId, plaintext),
  );

  return store;
};

/**
 * Alice adds the joiners in one commit and each, knowing the genesis that
 * names alice as creator, joins from its welcome.
 */
const join = async (
  alice: GroupMailboxMlsEngine,
  joiners: GroupMailboxMlsEngine[],
): Promise<void> => {
  const added = await alice.add(
    CONVERSATION,
    await Promise.all(joiners.map((joiner) => joiner.createKeyPackage())),
    sent,
  );
  for (const joiner of joiners) {
    await joiner.learnGenesis(GENESIS);
    await joiner.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );
  }
};

/** Alice creates the group and adds the others. */
const setup = async (
  names: string[],
): Promise<Record<string, GroupMailboxMlsEngine>> => {
  const engines = Object.fromEntries(names.map((name) => [name, engine(name)]));
  await engines.alice.createGroup(CONVERSATION);
  await join(
    engines.alice,
    names.filter((name) => name !== 'alice').map((name) => engines[name]),
  );

  return engines;
};

const indices = async (member: GroupMailboxMlsEngine): Promise<number[]> =>
  (await member.readableGenerations(CONVERSATION)).map(({ index }) => index);

describe('GroupMailboxMlsEngine on the real ts-mls library', () => {
  beforeAll(async () => {
    cast = await MlsTestIdentity.cast([...NAMES, 'eve', 'mallory']);
    CONVERSATION = new ConversationIdFactory()
      .createGroup(
        ConversationParticipantId.fromString(id('alice')),
        ConversationNetworkId.fromString(NETWORK),
        ConversationGroupNonce.fromString(NONCE),
      )
      .toString();
    GENESIS = GroupMailboxGenesis.of(CONVERSATION, {
      creatorIdentityId: id('alice'),
      networkId: NETWORK,
      nonce: NONCE,
    })!;
  });

  beforeEach(() => {
    roster = managedByAlice();
    clock = 1_000;
  });

  it('exports gen_0 at creation and lets every joiner export the generation of its welcome itself', async () => {
    const alice = engine('alice');
    const created = await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );
    await bob.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    const shared = await bob.generation(CONVERSATION);

    expect(created.index).toBe(0);
    expect(added.deliveryGeneration.secret.isEqual(created.secret)).toBe(true);
    expect(added.generation.index).toBe(1);
    expect(added.generation.secret.isEqual(created.secret)).toBe(false);
    expect(shared.index).toBe(1);
    expect(shared.secret.isEqual(added.generation.secret)).toBe(true);
  });

  it('advances the generation on an add, so a joiner never holds the one before it', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const before = await bob.generation(CONVERSATION);
    const carol = engine('carol');

    const added = await alice.add(
      CONVERSATION,
      [await carol.createKeyPackage()],
      sent,
    );
    await bob.applyCommit(CONVERSATION, added.commit);
    await carol.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    expect(added.generation.index).toBe(before.index + 1);
    expect(added.recipients).toEqual([id('alice'), id('bob')].sort());
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        added.generation.secret,
      ),
    ).toBe(true);
    expect(
      (await carol.generation(CONVERSATION)).secret.isEqual(
        added.generation.secret,
      ),
    ).toBe(true);
    expect(await indices(carol)).toEqual([before.index + 1]);
  });

  it('advances the generation on removal and never lets the removed member learn it', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const before = await alice.generation(CONVERSATION);

    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    const bobOutcome = await bob.applyCommit(CONVERSATION, removal!.commit);
    const carolOutcome = await carol.applyCommit(CONVERSATION, removal!.commit);
    const sealed = await alice.encrypt(
      CONVERSATION,
      text.encode('after carol left'),
    );

    expect(removal!.deliveryGeneration.secret.isEqual(before.secret)).toBe(
      true,
    );
    expect(removal!.generation.index).toBe(before.index + 1);
    expect(removal!.generation.secret.isEqual(before.secret)).toBe(false);
    expect(removal!.recipients).toEqual([id('alice'), id('bob')].sort());
    expect(bobOutcome.kind).toBe('applied');
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
    expect(carolOutcome.kind).toBe('removed');
    expect((await carol.generation(CONVERSATION)).index).toBe(before.index);
    await expect(
      carol.encrypt(CONVERSATION, text.encode('x')),
    ).rejects.toThrow();
    await expect(carol.decrypt(CONVERSATION, sealed)).rejects.toThrow();
    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'after carol left',
    );
  });

  it('rejects a message from a sender the current tree no longer holds', async () => {
    const { alice, carol } = await setup(['alice', 'bob', 'carol']);
    const late = await carol.encrypt(CONVERSATION, text.encode('still me'));

    await alice.remove(CONVERSATION, [id('carol')], sent);

    await expect(alice.decrypt(CONVERSATION, late)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
    await expect(alice.decrypt(CONVERSATION, late)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
  });

  it('still advances the generation when saving the log failed the first time', async () => {
    const generations = mock<GroupMailboxGenerationRepository>();
    const databaseName = `flaky-bob-${++database}`;
    const backing = sealedGroupStores(
      `${databaseName}-log`,
      id('bob'),
    ).generations;
    generations.load.mockImplementation((conversationId) =>
      backing.load(conversationId),
    );
    generations.save.mockImplementation((conversationId, log) =>
      backing.save(conversationId, log),
    );
    const alice = engine('alice');
    const bob = engine('bob', { databaseName, generations });
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    generations.save.mockRejectedValueOnce(new Error('quota'));

    await expect(
      bob.applyCommit(CONVERSATION, removal!.commit),
    ).rejects.toThrow();
    await bob.applyCommit(CONVERSATION, removal!.commit);

    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
  });

  it('publishes nothing when saving the log of its own removal fails', async () => {
    const generations = mock<GroupMailboxGenerationRepository>();
    const databaseName = `flaky-alice-${++database}`;
    const backing = sealedGroupStores(
      `${databaseName}-log`,
      id('alice'),
    ).generations;
    generations.load.mockImplementation((conversationId) =>
      backing.load(conversationId),
    );
    generations.save.mockImplementation((conversationId, log) =>
      backing.save(conversationId, log),
    );
    const alice = engine('alice', { databaseName, generations });
    const bob = engine('bob');
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);
    const publish = jest.fn(sent);
    generations.save.mockRejectedValueOnce(new Error('quota'));

    await expect(
      alice.remove(CONVERSATION, [id('carol')], publish),
    ).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
    const removal = await alice.remove(CONVERSATION, [id('carol')], publish);
    await bob.applyCommit(CONVERSATION, removal!.commit);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(removal!.generation.index).toBe(before.index + 1);
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
  });

  it('abandons its own commit when publishing it fails, so it stays in the epoch the others are in', async () => {
    const databaseName = `unpublished-${++database}`;
    const alice = engine('alice', { databaseName });
    const bob = engine('bob');
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);

    await expect(
      alice.remove(CONVERSATION, [id('carol')], () =>
        Promise.reject(new Error('outbox unavailable')),
      ),
    ).rejects.toThrow('outbox unavailable');
    const restarted = engine('alice', { databaseName });

    for (const member of [alice, restarted]) {
      const current = await member.generation(CONVERSATION);

      expect(current.index).toBe(before.index);
      expect(current.secret.isEqual(before.secret)).toBe(true);
    }
    expect(
      read(
        (
          await bob.decrypt(
            CONVERSATION,
            await alice.encrypt(CONVERSATION, text.encode('same epoch')),
          )
        ).plaintext,
      ),
    ).toBe('same epoch');
    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    await bob.applyCommit(CONVERSATION, removal!.commit);

    expect(removal!.generation.index).toBe(before.index + 1);
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
  });

  it('adopts its own published commit after stopping before it saved the group', async () => {
    const databaseName = `crashed-${++database}`;
    const store = flakyStore(databaseName, id('alice'));
    const alice = engine('alice', { databaseName, store });
    const bob = engine('bob');
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    let published: GroupMailboxCommit | undefined;

    await expect(
      alice.remove(CONVERSATION, [id('carol')], (made) => {
        published = made;
        store.saveGroup.mockRejectedValueOnce(new Error('crash'));

        return Promise.resolve();
      }),
    ).rejects.toThrow('crash');
    const restarted = engine('alice', { databaseName });
    const outcome = await restarted.applyCommit(
      CONVERSATION,
      published!.commit,
    );
    await bob.applyCommit(CONVERSATION, published!.commit);
    const sealed = await restarted.encrypt(
      CONVERSATION,
      text.encode('after the restart'),
    );

    expect(outcome.kind).toBe('applied');
    expect(
      (await restarted.generation(CONVERSATION)).secret.isEqual(
        published!.generation.secret,
      ),
    ).toBe(true);
    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'after the restart',
    );
  });

  it('never exposes the generation of an add that died before its group was saved', async () => {
    const databaseName = `flaky-add-${++database}`;
    const store = flakyStore(databaseName, id('alice'));
    const alice = engine('alice', { databaseName, store });
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    const before = await alice.generation(CONVERSATION);
    const keyPackage = await carol.createKeyPackage();
    const publish = jest.fn(sent);
    store.saveGroup.mockRejectedValueOnce(new Error('crash'));

    await expect(
      alice.add(CONVERSATION, [keyPackage], publish),
    ).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
    const restarted = engine('alice', { databaseName });
    expect(
      (await restarted.generation(CONVERSATION)).secret.isEqual(before.secret),
    ).toBe(true);
    const added = await restarted.add(CONVERSATION, [keyPackage], sent);
    await carol.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    expect(
      (await carol.generation(CONVERSATION)).secret.isEqual(
        (await restarted.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
  });

  it('keeps the key package when saving the joined group fails', async () => {
    const databaseName = `flaky-join-${++database}`;
    const store = flakyStore(databaseName, id('bob'));
    const alice = engine('alice');
    const bob = engine('bob', { databaseName, store });
    await alice.createGroup(CONVERSATION);
    const added = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );
    store.saveGroup.mockRejectedValueOnce(new Error('quota'));

    await expect(
      bob.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('alice'),
      ),
    ).rejects.toThrow();
    await bob.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        added.generation.secret,
      ),
    ).toBe(true);
  });

  it('rejects a welcome index that is not a non-negative safe integer', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );

    for (const index of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        bob.join(CONVERSATION, added.welcome!, index, id('alice')),
      ).rejects.toBeInstanceOf(MlsRejectedError);
    }
    await bob.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    expect((await bob.generation(CONVERSATION)).index).toBe(
      added.generation.index,
    );
  });

  it('rejects a welcome from a peer the roster does not let add devices', async () => {
    const alice = engine('alice');
    const bob = engine('bob', { rosterView: unmanaged });
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob]);
    // Bob, who may not add anyone, makes a group of his own under the same id.
    const forger = engine('bob', { device: 'd2', rosterView: unmanaged });
    await forger.createGroup(CONVERSATION);
    const forged = await forger.add(
      CONVERSATION,
      [await carol.createKeyPackage()],
      sent,
    );

    await expect(
      carol.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('bob'),
      ),
    ).rejects.toThrow('The welcome is not from a member who may add devices');
  });

  it('rejects a welcome sent in the name of a manager who holds no leaf in it', async () => {
    // Dave, who may not add anyone, invites bob and names alice as inviter.
    const forger = engine('dave', { rosterView: unmanaged });
    const bob = engine('bob');
    await forger.createGroup(CONVERSATION);
    const forged = await forger.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );

    for (const inviter of [id('alice'), id('dave')]) {
      await expect(
        bob.join(
          CONVERSATION,
          forged.welcome!,
          forged.generation.index,
          inviter,
        ),
      ).rejects.toThrow('The welcome is not from a member who may add devices');
    }
  });

  it('lets a member who may not add anyone add its own second device, which joins from its own welcome', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = engine('bob', { device: 'd2' });
    const added = await bob.add(
      CONVERSATION,
      [await phone.createKeyPackage()],
      sent,
    );
    await alice.applyCommit(CONVERSATION, added.commit);

    await phone.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('bob'),
    );
    const sealed = await alice.encrypt(CONVERSATION, text.encode('to both'));
    const fromSibling = await bob.encrypt(CONVERSATION, text.encode('mine'));

    expect(read((await phone.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'to both',
    );
    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'to both',
    );
    const opened = await phone.decrypt(CONVERSATION, fromSibling);
    expect(read(opened.plaintext)).toBe('mine');
    expect(opened.sender).toEqual(cast.bob.owner('d1'));
    expect(await phone.devices(CONVERSATION)).toEqual(
      [cast.bob.deviceCredential('d1'), cast.bob.deviceCredential('d2')].sort(),
    );
    expect(await alice.devices(CONVERSATION)).toEqual([
      cast.alice.deviceCredential('d1'),
    ]);
  });

  it('refuses to let a member add another identity with its own devices', async () => {
    const { bob } = await setup(['alice', 'bob']);
    const publish = jest.fn(sent);

    await expect(
      bob.add(
        CONVERSATION,
        [
          await engine('bob', { device: 'd2' }).createKeyPackage(),
          await engine('dave').createKeyPackage(),
        ],
        publish,
      ),
    ).rejects.toThrow('This member may not make this change');
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a welcome of its own identity into a group nobody else is in', async () => {
    // A revoked device keeps the identity key and could make such a group.
    const revoked = engine('bob', {
      device: 'd9',
      rosterView: unmanaged,
      verified: () => ['d2', 'd9'],
    });
    const phone = engine('bob', { device: 'd2' });
    await revoked.createGroup(CONVERSATION);
    const forged = await revoked.add(
      CONVERSATION,
      [await phone.createKeyPackage()],
      sent,
    );

    await expect(
      phone.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('bob'),
      ),
    ).rejects.toThrow('The welcome is not from a member who may add devices');
    expect(await phone.devices(CONVERSATION)).toEqual([]);
  });

  it.each([
    ['an identity the roster does not list', ['alice', 'bob']],
    ['a roster that no longer lists its identity', ['alice', 'carol']],
  ])(
    'rejects a welcome of its own identity into a group holding %s',
    async (_case, listed) => {
      // A revoked device keeps the identity key and could add anyone; joining
      // checks every leaf's identity against the roster before the inviter.
      const revoked = engine('bob', {
        device: 'd9',
        rosterView: unmanaged,
        verified: () => ['d2', 'd9'],
      });
      const phone = engine('bob', {
        device: 'd2',
        rosterView: () =>
          GroupMailboxRoster.of({
            adminIds: [],
            participantIds: listed.map(id),
          }),
      });
      await revoked.createGroup(CONVERSATION);
      await revoked.add(
        CONVERSATION,
        [await engine('carol').createKeyPackage()],
        sent,
      );
      const forged = await revoked.add(
        CONVERSATION,
        [await phone.createKeyPackage()],
        sent,
      );

      await expect(
        phone.join(
          CONVERSATION,
          forged.welcome!,
          forged.generation.index,
          id('bob'),
        ),
      ).rejects.toThrow(MlsRejectedError);
      expect(await phone.devices(CONVERSATION)).toEqual([]);
    },
  );

  it('rejects a welcome of its own identity from a device its signed transitions no longer authorize', async () => {
    // The revoked laptop still holds the identity key and still believes
    // itself current; it builds a look-alike group with someone else in it.
    const revoked = engine('bob', {
      device: 'd9',
      rosterView: unmanaged,
      verified: () => ['d2', 'd9'],
    });
    const phone = engine('bob', { device: 'd2', rosterView: unmanaged });
    await revoked.createGroup(CONVERSATION);
    await revoked.add(
      CONVERSATION,
      [await engine('alice').createKeyPackage()],
      sent,
    );
    const forged = await revoked.add(
      CONVERSATION,
      [await phone.createKeyPackage()],
      sent,
    );

    await expect(
      phone.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('bob'),
      ),
    ).rejects.toThrow('The welcome is not from a member who may add devices');
    expect(await phone.devices(CONVERSATION)).toEqual([]);
  });

  it('rejects a welcome another member signed in the name of the inviter the node names', async () => {
    // Dave may not add anyone; the node claims Alice, who holds a leaf.
    const forger = engine('dave', { rosterView: unmanaged });
    const carol = engine('carol');
    await forger.createGroup(CONVERSATION);
    await forger.add(
      CONVERSATION,
      [await engine('alice').createKeyPackage()],
      sent,
    );
    const forged = await forger.add(
      CONVERSATION,
      [await carol.createKeyPackage()],
      sent,
    );

    await expect(
      carol.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('alice'),
      ),
    ).rejects.toThrow('The welcome is not from a member who may add devices');
    expect(await carol.devices(CONVERSATION)).toEqual([]);
  });

  it.each([
    [
      'adds a device',
      async (laptop: GroupMailboxMlsEngine) =>
        laptop.add(
          CONVERSATION,
          [await engine('bob', { device: 'd2' }).createKeyPackage()],
          sent,
        ),
    ],
    [
      'removes a device',
      async (laptop: GroupMailboxMlsEngine) =>
        (await laptop.removeDevices(
          CONVERSATION,
          [cast.bob.deviceCredential('d1')],
          sent,
        ))!,
    ],
  ])(
    'rejects a commit that %s of its own identity from a device its signed transitions no longer authorize',
    async (_case, change) => {
      let current = ['d1', 'd9'];
      const alice = engine('alice');
      const bob = engine('bob', { verified: () => current });
      const laptop = engine('bob', {
        device: 'd9',
        verified: () => ['d1', 'd2', 'd9'],
      });
      await alice.createGroup(CONVERSATION);
      await join(alice, [bob]);
      const added = await bob.add(
        CONVERSATION,
        [await laptop.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, added.commit);
      await laptop.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );
      // The phone revokes the laptop before the laptop's leaf is removed.
      current = ['d1'];
      const made = await change(laptop);

      await expect(
        bob.applyCommit(CONVERSATION, made.commit),
      ).rejects.toBeInstanceOf(MlsRejectedError);
      expect(await bob.devices(CONVERSATION)).toEqual(
        [
          cast.bob.deviceCredential('d1'),
          cast.bob.deviceCredential('d9'),
        ].sort(),
      );
      // Another identity cannot read Bob's transitions and follows the roster.
      await expect(
        alice.applyCommit(CONVERSATION, made.commit),
      ).resolves.toMatchObject({ kind: 'applied' });
    },
  );

  /**
   * Alice's phone creates the group with bob and carol and adds her laptop;
   * the phone checks her commits against `verified`.
   */
  const aliceWithLaptop = async (
    verified: () => readonly string[],
  ): Promise<Record<string, GroupMailboxMlsEngine>> => {
    const phone = engine('alice', { verified });
    const laptop = engine('alice', {
      device: 'd9',
      verified: () => ['d1', 'd9'],
    });
    const bob = engine('bob');
    const carol = engine('carol');
    await phone.createGroup(CONVERSATION);
    await join(phone, [bob, carol]);
    const added = await phone.add(
      CONVERSATION,
      [await laptop.createKeyPackage()],
      sent,
    );
    for (const member of [bob, carol]) {
      await member.applyCommit(CONVERSATION, added.commit);
    }
    await laptop.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('alice'),
    );

    return { bob, carol, laptop, phone };
  };

  it('rejects any commit of its own identity from a device its signed transitions no longer authorize, also one that leaves its own leaves alone', async () => {
    let current = ['d1', 'd9'];
    const { bob, laptop, phone } = await aliceWithLaptop(() => current);
    const before = await phone.generation(CONVERSATION);
    // The phone revokes the laptop, which still holds the identity key and
    // removes carol in the name of the creator.
    current = ['d1'];
    const removal = await laptop.remove(CONVERSATION, [id('carol')], sent);

    await expect(
      phone.applyCommit(CONVERSATION, removal!.commit),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect(await phone.members(CONVERSATION)).toContain(id('carol'));
    expect((await phone.generation(CONVERSATION)).index).toBe(before.index);
    // Another identity cannot read Alice's transitions and follows the roster.
    await expect(
      bob.applyCommit(CONVERSATION, removal!.commit),
    ).resolves.toMatchObject({ kind: 'applied' });
  });

  it('judges no commit of its own identity while its signed transitions are unproven, and leaves it to be retried', async () => {
    let unproven = false;
    const { laptop, phone } = await aliceWithLaptop(() => {
      if (unproven) throw new Error('Transitions unproven');

      return ['d1', 'd9'];
    });
    unproven = true;
    const removal = await laptop.remove(CONVERSATION, [id('carol')], sent);

    const failed = phone.applyCommit(CONVERSATION, removal!.commit);

    await expect(failed).rejects.toThrow('Transitions unproven');
    await expect(failed).rejects.not.toBeInstanceOf(MlsRejectedError);
    expect(await phone.members(CONVERSATION)).toContain(id('carol'));
    unproven = false;
    await expect(
      phone.applyCommit(CONVERSATION, removal!.commit),
    ).resolves.toMatchObject({ kind: 'applied' });
    expect(await phone.members(CONVERSATION)).not.toContain(id('carol'));
  });

  it('refuses to commit from a device its own signed transitions no longer authorize', async () => {
    let current = ['d1', 'd9'];
    const laptop = engine('alice', { device: 'd9', verified: () => current });
    await laptop.createGroup(CONVERSATION);
    await join(laptop, [engine('bob'), engine('carol')]);
    const publish = jest.fn(sent);
    current = ['d1'];

    await expect(
      laptop.remove(CONVERSATION, [id('carol')], publish),
    ).rejects.toThrow('This member may not make this change');
    expect(publish).not.toHaveBeenCalled();
  });

  it('removes a revoked device of its own identity, which cannot read on', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const laptop = engine('bob', { device: 'd2' });
    const added = await bob.add(
      CONVERSATION,
      [await laptop.createKeyPackage()],
      sent,
    );
    await alice.applyCommit(CONVERSATION, added.commit);
    await laptop.join(
      CONVERSATION,
      added.welcome!,
      added.generation.index,
      id('bob'),
    );

    const removal = await bob.removeDevices(
      CONVERSATION,
      [cast.bob.deviceCredential('d2')],
      sent,
    );
    await alice.applyCommit(CONVERSATION, removal!.commit);
    await laptop.applyCommit(CONVERSATION, removal!.commit);
    const after = await alice.encrypt(CONVERSATION, text.encode('after'));

    expect(read((await bob.decrypt(CONVERSATION, after)).plaintext)).toBe(
      'after',
    );
    await expect(laptop.decrypt(CONVERSATION, after)).rejects.toThrow();
    expect(await laptop.devices(CONVERSATION)).toEqual([]);
    expect(await bob.devices(CONVERSATION)).toEqual([
      cast.bob.deviceCredential('d1'),
    ]);
    expect((await alice.generation(CONVERSATION)).index).toBe(
      removal!.generation.index,
    );
    await expect(
      bob.removeDevices(CONVERSATION, [cast.bob.deviceCredential('d2')], sent),
    ).resolves.toBeUndefined();
  });

  it('keeps a removed device out when a forged welcome of a later epoch arrives', async () => {
    const { alice, carol } = await setup(['alice', 'bob', 'carol']);
    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    await carol.applyCommit(CONVERSATION, removal!.commit);
    // Dave, who may not add anyone, races a same-id group past carol's epoch.
    const forger = engine('dave', { rosterView: unmanaged });
    await forger.createGroup(CONVERSATION);
    for (const device of ['d2', 'd3', 'd4']) {
      await forger.add(
        CONVERSATION,
        [await engine('dave', { device }).createKeyPackage()],
        sent,
      );
    }
    const forged = await forger.add(
      CONVERSATION,
      [await carol.createKeyPackage()],
      sent,
    );

    for (const inviter of [id('dave'), id('alice')]) {
      await expect(
        carol.join(
          CONVERSATION,
          forged.welcome!,
          forged.generation.index,
          inviter,
        ),
      ).rejects.toThrow('The welcome is not from a member who may add devices');
    }
    await expect(
      carol.encrypt(CONVERSATION, text.encode('let me back in')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('refuses to add a device whose key package names another identity', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    // Bob's key signs a credential that claims a device of carol.
    const forged = await generateMlsKeyPackage(
      new MlsLeafSigner(
        cast.carol.owner('d9'),
        cast.bob.keyPair,
        cast.carol.deviceKeyPair('d9'),
      ),
    );

    await expect(
      alice.add(CONVERSATION, [forged.publicBytes], sent),
    ).rejects.toThrow('Key package credential is forged');
    expect(await alice.members(CONVERSATION)).toEqual([id('alice')]);
  });

  it('refuses to add or remove a member when the roster does not let this member', async () => {
    const { bob } = await setup(['alice', 'bob', 'carol']);
    const publish = jest.fn(sent);

    await expect(
      bob.add(CONVERSATION, [await engine('dave').createKeyPackage()], publish),
    ).rejects.toThrow('This member may not make this change');
    await expect(
      bob.remove(CONVERSATION, [id('carol')], publish),
    ).rejects.toThrow('This member may not make this change');
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a removal by a member the roster does not let remove', async () => {
    let bobView = managedByAlice();
    const alice = engine('alice');
    const bob = engine('bob', { rosterView: () => bobView });
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);
    // A patched client that believes it created the conversation.
    bobView = GroupMailboxRoster.of({
      adminIds: [],
      creatorId: id('bob'),
      participantIds: NAMES.map(id),
    });
    const removal = await bob.remove(CONVERSATION, [id('carol')], sent);

    for (const member of [alice, carol]) {
      await expect(
        member.applyCommit(CONVERSATION, removal!.commit),
      ).rejects.toBeInstanceOf(MlsRejectedError);
      expect((await member.generation(CONVERSATION)).index).toBe(before.index);
    }
  });

  it('lets a removed device join again from a new welcome only', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const first = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );
    await bob.join(
      CONVERSATION,
      first.welcome!,
      first.generation.index,
      id('alice'),
    );
    const removal = await alice.remove(CONVERSATION, [id('bob')], sent);
    await bob.applyCommit(CONVERSATION, removal!.commit);

    const again = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );
    await bob.join(
      CONVERSATION,
      again.welcome!,
      again.generation.index,
      id('alice'),
    );
    const sealed = await alice.encrypt(CONVERSATION, text.encode('back'));

    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'back',
    );
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        (await alice.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
    await expect(
      bob.join(
        CONVERSATION,
        first.welcome!,
        first.generation.index,
        id('alice'),
      ),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('names the authenticated MLS sender of every message', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);

    const sealed = await bob.encrypt(CONVERSATION, text.encode('from bob'));
    const opened = await alice.decrypt(CONVERSATION, sealed);

    expect(opened.sender).toEqual(cast.bob.owner());
    expect(read(opened.plaintext)).toBe('from bob');
  });

  it('rejects a member message whose content was altered and reads on', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const sealed = await bob.encrypt(CONVERSATION, text.encode('altered'));
    const altered = sealed.slice();

    altered[altered.length - 1] = (altered[altered.length - 1] + 1) % 256;

    await expect(alice.decrypt(CONVERSATION, altered)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
    const opened = await alice.decrypt(
      CONVERSATION,
      await bob.encrypt(CONVERSATION, text.encode('next')),
    );

    expect(read(opened.plaintext)).toBe('next');
  });

  it('reads one message twice, including its own, without consuming the ratchet twice', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);

    const sealed = await alice.encrypt(CONVERSATION, text.encode('again'));
    const first = await bob.decrypt(CONVERSATION, sealed);
    const second = await bob.decrypt(CONVERSATION, sealed);
    const own = await alice.decrypt(CONVERSATION, sealed);

    expect(read(second.plaintext)).toBe('again');
    expect(second.sender).toEqual(first.sender);
    expect(own.sender).toEqual(cast.alice.owner());
    expect(read(own.plaintext)).toBe('again');
  });

  it('rejects a commit forged in another group and keeps its generation', async () => {
    const { alice } = await setup(['alice', 'bob']);
    const before = await alice.generation(CONVERSATION);
    const dave = engine('dave', { rosterView: unmanaged });
    await dave.createGroup(CONVERSATION);
    const forged = await dave.add(
      CONVERSATION,
      [await engine('carol').createKeyPackage()],
      sent,
    );

    await expect(
      alice.applyCommit(CONVERSATION, forged.commit),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect(
      (await alice.generation(CONVERSATION)).secret.isEqual(before.secret),
    ).toBe(true);
  });

  it('rejects a tampered commit', async () => {
    const { alice, bob } = await setup(['alice', 'bob', 'carol']);
    const before = await bob.generation(CONVERSATION);
    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    const tampered = new Uint8Array(removal!.commit);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] + 1) % 256;

    await expect(
      bob.applyCommit(CONVERSATION, tampered),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await bob.generation(CONVERSATION)).index).toBe(before.index);
  });

  it('keeps a removed member unable to send after a restart', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const carol = engine('carol', { databaseName: 'carol-restart' });
    await join(alice, [carol]);
    const joined = await carol.generation(CONVERSATION);
    const removal = await alice.remove(CONVERSATION, [id('carol')], sent);
    await carol.applyCommit(CONVERSATION, removal!.commit);
    const restarted = engine('carol', { databaseName: 'carol-restart' });

    await expect(
      restarted.encrypt(CONVERSATION, text.encode('still here?')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await restarted.generation(CONVERSATION)).index).toBe(joined.index);
  });

  it('rejects a replayed welcome, also after the member was removed', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );
    const { index } = added.generation;
    await bob.join(CONVERSATION, added.welcome!, index, id('alice'));

    await expect(
      bob.join(CONVERSATION, added.welcome!, index, id('alice')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    const removal = await alice.remove(CONVERSATION, [id('bob')], sent);
    await bob.applyCommit(CONVERSATION, removal!.commit);
    await expect(
      bob.join(CONVERSATION, added.welcome!, index, id('alice')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(
      engine('carol').join(CONVERSATION, added.welcome!, index, id('alice')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('refuses to add an identity the conversation roster does not list', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);

    await expect(
      alice.add(CONVERSATION, [await engine('eve').createKeyPackage()], sent),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('still reads a message a remaining member sent in the epoch before a removal', async () => {
    const { alice, bob } = await setup(['alice', 'bob', 'carol']);
    const inFlight = await bob.encrypt(CONVERSATION, text.encode('in flight'));

    await alice.remove(CONVERSATION, [id('carol')], sent);

    expect(read((await alice.decrypt(CONVERSATION, inFlight)).plaintext)).toBe(
      'in flight',
    );
  });

  it('keeps retired generations readable for the drain window only', async () => {
    const { alice } = await setup(['alice', 'bob', 'carol']);

    await alice.remove(CONVERSATION, [id('carol')], sent);

    expect(await indices(alice)).toEqual([2, 1, 0]);
    clock += GroupMailboxGeneration.DRAIN_WINDOW_MS + 1;
    expect(await indices(alice)).toEqual([2]);
  });

  it('restores group state and generations in a new engine instance', async () => {
    const alice = engine('alice', { databaseName: 'alice-restore' });
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    await join(alice, [bob]);
    const restored = engine('alice', { databaseName: 'alice-restore' });

    const sealed = await restored.encrypt(CONVERSATION, text.encode('back'));

    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'back',
    );
    expect(
      (await restored.generation(CONVERSATION)).secret.isEqual(
        (await bob.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
    expect(await restored.members(CONVERSATION)).toEqual(
      [id('alice'), id('bob')].sort(),
    );
  });

  describe('confirming a welcomed group', () => {
    /**
     * Alice creates the group under a roster that lets every member add,
     * bob joins from alice knowing the genesis, and bob then welcomes
     * carol, who knows only what `carol` brings.
     */
    const welcomedByBob = async (carol: GroupMailboxMlsEngine) => {
      roster = unmanaged();
      const alice = engine('alice');
      const bob = engine('bob');
      await alice.createGroup(CONVERSATION);
      await join(alice, [bob]);
      const added = await bob.add(
        CONVERSATION,
        [await carol.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, added.commit);
      await carol.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );

      return { alice, bob };
    };

    it('confirms a group it created and one the creator its genesis names welcomed it into', async () => {
      const alice = engine('alice');
      const bob = engine('bob');
      await alice.createGroup(CONVERSATION);

      expect(await alice.awaitsConfirmation(CONVERSATION)).toBe(false);
      await join(alice, [bob]);

      expect(await bob.awaitsConfirmation(CONVERSATION)).toBe(false);
      expect(
        read(
          (
            await alice.decrypt(
              CONVERSATION,
              await bob.encrypt(CONVERSATION, text.encode('hi')),
            )
          ).plaintext,
        ),
      ).toBe('hi');
    });

    it('holds a welcome from the creator unconfirmed when this device does not know the genesis', async () => {
      const alice = engine('alice');
      const bob = engine('bob');
      await alice.createGroup(CONVERSATION);
      const added = await alice.add(
        CONVERSATION,
        [await bob.createKeyPackage()],
        sent,
      );
      await bob.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('alice'),
      );

      expect(await bob.awaitsConfirmation(CONVERSATION)).toBe(true);
      await expect(
        bob.encrypt(CONVERSATION, text.encode('early')),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
    });

    it('sends nothing into a group a non-creator welcomed it into until the creator speaks', async () => {
      const carol = engine('carol');
      await carol.learnGenesis(GENESIS);
      const { alice, bob } = await welcomedByBob(carol);
      const publish = jest.fn(sent);

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(true);
      await expect(
        carol.encrypt(CONVERSATION, text.encode('early')),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
      await expect(
        carol.add(
          CONVERSATION,
          [await engine('dave').createKeyPackage()],
          publish,
        ),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
      await expect(
        carol.remove(CONVERSATION, [id('bob')], publish),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
      await expect(
        carol.removeDevices(
          CONVERSATION,
          [cast.carol.deviceCredential('d2')],
          publish,
        ),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
      expect(publish).not.toHaveBeenCalled();

      // The welcomer itself never confirms the group it made.
      await carol.decrypt(
        CONVERSATION,
        await bob.encrypt(CONVERSATION, text.encode('trust me')),
      );
      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(true);

      await carol.decrypt(
        CONVERSATION,
        await alice.encrypt(CONVERSATION, text.encode('welcome')),
      );

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(false);
      expect(
        read(
          (
            await bob.decrypt(
              CONVERSATION,
              await carol.encrypt(CONVERSATION, text.encode('now')),
            )
          ).plaintext,
        ),
      ).toBe('now');
    });

    it('is confirmed by a commit of the creator', async () => {
      const carol = engine('carol');
      await carol.learnGenesis(GENESIS);
      const { alice } = await welcomedByBob(carol);
      const phoneAdded = await alice.add(
        CONVERSATION,
        [await engine('alice', { device: 'd2' }).createKeyPackage()],
        sent,
      );

      await carol.applyCommit(CONVERSATION, phoneAdded.commit);

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(false);
    });

    it('is confirmed by a contact pinned before the welcome whose leaf its own commit wrote', async () => {
      roster = unmanaged();
      const alice = engine('alice');
      const bob = engine('bob');
      const dave = engine('dave');
      const davePhone = engine('dave', { device: 'd2' });
      const carol = engine('carol', { contacts: () => [id('dave')] });
      await alice.createGroup(CONVERSATION);
      await join(alice, [bob, dave]);
      // Dave adds and removes a device of his own: the removal's path
      // rewrites his leaf.
      const phoneAdded = await dave.add(
        CONVERSATION,
        [await davePhone.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, phoneAdded.commit);
      await bob.applyCommit(CONVERSATION, phoneAdded.commit);
      const phoneRemoved = await dave.removeDevices(
        CONVERSATION,
        [cast.dave.deviceCredential('d2')],
        sent,
      );
      await alice.applyCommit(CONVERSATION, phoneRemoved!.commit);
      await bob.applyCommit(CONVERSATION, phoneRemoved!.commit);
      const added = await bob.add(
        CONVERSATION,
        [await carol.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, added.commit);
      await dave.applyCommit(CONVERSATION, added.commit);
      await carol.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(true);
      await carol.decrypt(
        CONVERSATION,
        await dave.encrypt(CONVERSATION, text.encode('it is me')),
      );

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(false);
    });

    it('is never confirmed by a contact whose leaf only an add wrote, nor by the welcomer as a contact', async () => {
      roster = unmanaged();
      const alice = engine('alice');
      const bob = engine('bob');
      const dave = engine('dave');
      const carol = engine('carol', {
        contacts: () => [id('bob'), id('dave')],
      });
      await alice.createGroup(CONVERSATION);
      await join(alice, [bob]);
      // Bob adds dave's published key package and carol in one commit.
      const added = await bob.add(
        CONVERSATION,
        [await dave.createKeyPackage(), await carol.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, added.commit);
      await dave.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );
      await carol.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );
      // Alice is not a contact and carol never learned the genesis.
      for (const speaker of [alice, bob]) {
        await carol.decrypt(
          CONVERSATION,
          await speaker.encrypt(CONVERSATION, text.encode('hello')),
        );
      }

      expect(await carol.awaitsConfirmation(CONVERSATION)).toBe(true);
      expect(await dave.awaitsConfirmation(CONVERSATION)).toBe(true);
    });

    it('keeps the confirmation state across a restart', async () => {
      const databaseName = `confirm-restart-${++database}`;
      const carol = engine('carol', { databaseName });
      await carol.learnGenesis(GENESIS);
      const { alice } = await welcomedByBob(carol);

      expect(
        await engine('carol', { databaseName }).awaitsConfirmation(
          CONVERSATION,
        ),
      ).toBe(true);
      await carol.decrypt(
        CONVERSATION,
        await alice.encrypt(CONVERSATION, text.encode('welcome')),
      );

      expect(
        await engine('carol', { databaseName }).awaitsConfirmation(
          CONVERSATION,
        ),
      ).toBe(false);
    });

    it('confirms a welcome from another device of its own identity', async () => {
      const { alice, bob } = await setup(['alice', 'bob']);
      const phone = engine('bob', { device: 'd2' });
      const added = await bob.add(
        CONVERSATION,
        [await phone.createKeyPackage()],
        sent,
      );
      await alice.applyCommit(CONVERSATION, added.commit);

      await phone.join(
        CONVERSATION,
        added.welcome!,
        added.generation.index,
        id('bob'),
      );

      expect(await phone.awaitsConfirmation(CONVERSATION)).toBe(false);
    });

    it('holds a group without a confirmation record unconfirmed, as one kept before the rule', async () => {
      const databaseName = `confirm-missing-${++database}`;
      const store = flakyStore(databaseName, id('alice'));
      const backing = sealedGroupStores(databaseName, id('alice')).state;

      // A store from before the rule never held a confirmation record.
      store.saveGroup.mockImplementation((groupId, state) =>
        groupId.endsWith('#confirmation')
          ? Promise.resolve()
          : backing.saveGroup(groupId, state),
      );
      const alice = engine('alice', { databaseName, store });
      await alice.createGroup(CONVERSATION);
      const restarted = engine('alice', { databaseName });

      expect(await restarted.awaitsConfirmation(CONVERSATION)).toBe(true);
      await expect(
        restarted.encrypt(CONVERSATION, text.encode('old group')),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
    });
  });
});
