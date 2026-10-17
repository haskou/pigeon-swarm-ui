import 'fake-indexeddb/auto';
import type {
  MlsContextExtension,
  MlsMembershipPolicy,
} from '@haskou/pigeon-swarm-crypto/mls';

import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import {
  GroupMailboxRosterExtension,
  InvalidMlsExtensionError,
  MlsGroup,
  MlsKeyPackage,
  MlsLeafSigner,
} from '@haskou/pigeon-swarm-crypto/mls';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxGenerationRepository } from '../../../../../contexts/groupMailboxes/domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxCommit } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxCommit';

import { MlsUpdateCadence } from '../../../../../contexts/communities/domain/MlsUpdateCadence';
import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxGenesis } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGenesis';
import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { GroupMailboxRosterContext } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxRosterContext';
import { GroupMailboxUnconfirmedError } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxUnconfirmedError';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';
import { MlsTestIdentity } from '../../../communities/infrastructure/mls/MlsTestIdentity';
import { rosterOf } from '../../rosterOf';
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
let roster: GroupMailboxRoster;
let clock = 0;
let database = 0;

const id = (name: string): string => cast[name].id;

/** Alice created the conversation and is its only manager. */
const managedByAlice = (): GroupMailboxRoster =>
  rosterOf(NAMES.map(id), { conversationId: CONVERSATION });

/** Alice created the conversation and made bob an admin; eve is listed too. */
const bobAdministers = (): GroupMailboxRoster =>
  rosterOf([...NAMES, 'eve'].map(id), {
    adminIds: [id('bob')],
    conversationId: CONVERSATION,
  });

/** A roster of this conversation that names `name` as its creator. */
const forgedBy = (name: string): GroupMailboxRoster =>
  rosterOf([name, ...NAMES.filter((other) => other !== name)].map(id), {
    conversationId: CONVERSATION,
  });

/** The devices of an identity its signed transitions authorize: not d9. */
const CURRENT_DEVICES = ['d1', 'd2', 'd3', 'd4'];

const engine = (
  name: string,
  options: {
    databaseName?: string;
    device?: string;
    generations?: GroupMailboxGenerationRepository;
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
    () =>
      Promise.resolve(
        (options.verified?.() ?? CURRENT_DEVICES).map((device) =>
          cast[name].deviceCredential(device),
        ),
      ),
    () => options.contacts?.() ?? [],
    () => clock,
    () => 0,
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

/**
 * Commits the roster without `name`, which drops its leaves in the same
 * commit: the only way a member leaves the group.
 */
const drop = async (
  member: GroupMailboxMlsEngine,
  name: string,
  publish: (commit: GroupMailboxCommit) => Promise<void> = sent,
): Promise<GroupMailboxCommit> =>
  member.changeRoster(
    CONVERSATION,
    (await member.roster(CONVERSATION))!.withoutMember(id(name))!,
    publish,
  );

/** Alice creates the group and adds the others. */
const setup = async (
  names: string[],
): Promise<Record<string, GroupMailboxMlsEngine>> => {
  const engines = Object.fromEntries(names.map((name) => [name, engine(name)]));
  await engines.alice.createGroup(CONVERSATION, roster);
  await join(
    engines.alice,
    names.filter((name) => name !== 'alice').map((name) => engines[name]),
  );

  return engines;
};

const indices = async (member: GroupMailboxMlsEngine): Promise<number[]> =>
  (await member.readableGenerations(CONVERSATION)).map(({ index }) => index);

/** A commit's id as every member derives it from the commit bytes. */
const commitIdOf = (bytes: Uint8Array): string =>
  SHA256Hash.from(encodeBase64Url(bytes)).toString();

const UNWANTED_ID = new Error('Commit id not wanted');

/**
 * Commits with `make` until the commit id is `wanted`, as a member grinding
 * for a low id would: a commit whose publishing fails is abandoned, so its
 * committer stays in the epoch and commits again.
 */
const ground = async (
  make: (
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ) => Promise<GroupMailboxCommit | undefined>,
  wanted: (commitId: string) => boolean,
): Promise<{ commit: Uint8Array; id: string }> => {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    try {
      const made = await make(({ commit }) =>
        wanted(commitIdOf(commit))
          ? Promise.resolve()
          : Promise.reject(UNWANTED_ID),
      );

      return { commit: made!.commit, id: commitIdOf(made!.commit) };
    } catch (error) {
      if (error !== UNWANTED_ID) throw error;
    }
  }
  throw new Error('No commit id was wanted');
};

/** An id in the upper half, so a rival grinds below it in a few tries. */
const high = (commitId: string): boolean => commitId >= '8';

/** Every order the commits can arrive in. */
const ordersOf = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        ordersOf(items.filter((_, other) => other !== index)).map((rest) => [
          item,
          ...rest,
        ]),
      );

describe('GroupMailboxMlsEngine on the real MLS library', () => {
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
    const created = await alice.createGroup(CONVERSATION, roster);
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
    const rosterBefore = (await alice.roster(CONVERSATION))!;

    const removal = await drop(alice, 'carol');
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
    expect(removal!.welcome).toBeUndefined();
    expect(removal!.recipients).toEqual(
      [id('alice'), id('bob'), id('carol')].sort(),
    );
    expect(bobOutcome.kind).toBe('applied');
    // The commit carol receives carries the roster without her and no add.
    expect((await bob.roster(CONVERSATION))!.toFields()).toEqual(
      rosterBefore.withoutMember(id('carol'))!.toFields(),
    );
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

  it('adds no leaf while a leaver keeps one, and drops that leaf with no add', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const left = await carol.changeRoster(
      CONVERSATION,
      (await carol.roster(CONVERSATION))!.withoutMember(id('carol'))!,
      sent,
    );
    await alice.applyCommit(CONVERSATION, left.commit);
    await bob.applyCommit(CONVERSATION, left.commit);
    const keyPackage = await engine('dave').createKeyPackage();

    await expect(
      alice.add(CONVERSATION, [keyPackage], sent),
    ).rejects.toBeInstanceOf(MlsRejectedError);

    const stray = await alice.remove(CONVERSATION, [id('carol')], sent);
    const added = await alice.add(CONVERSATION, [keyPackage], sent);

    expect(stray!.welcome).toBeUndefined();
    expect(stray!.recipients).toEqual(
      [id('alice'), id('bob'), id('carol')].sort(),
    );
    expect(added.welcome).toBeDefined();
    expect(added.recipients).toEqual([id('alice'), id('bob')].sort());
    expect(await alice.members(CONVERSATION)).not.toContain(id('carol'));
  });

  it('rejects a message from a sender the current tree no longer holds', async () => {
    const { alice, carol } = await setup(['alice', 'bob', 'carol']);
    const late = await carol.encrypt(CONVERSATION, text.encode('still me'));

    await drop(alice, 'carol');

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
    await alice.createGroup(CONVERSATION, roster);
    await join(alice, [bob, carol]);
    const removal = await drop(alice, 'carol');
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
    await alice.createGroup(CONVERSATION, roster);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);
    const publish = jest.fn(sent);
    generations.save.mockRejectedValueOnce(new Error('quota'));

    await expect(drop(alice, 'carol', publish)).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
    const removal = await drop(alice, 'carol', publish);
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
    await alice.createGroup(CONVERSATION, roster);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);

    await expect(
      drop(alice, 'carol', () =>
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
    const removal = await drop(alice, 'carol');
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
    await alice.createGroup(CONVERSATION, roster);
    await join(alice, [bob, carol]);
    let published: GroupMailboxCommit | undefined;

    await expect(
      drop(alice, 'carol', (made) => {
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
    await alice.createGroup(CONVERSATION, roster);
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
    await alice.createGroup(CONVERSATION, roster);
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
    await alice.createGroup(CONVERSATION, roster);
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

  it('rejects a welcome whose roster names another creator than the genesis', async () => {
    const carol = engine('carol');
    // Bob makes a group of his own under alice's id, naming himself creator.
    const forger = engine('bob', { device: 'd2' });
    await forger.createGroup(CONVERSATION, forgedBy('bob'));
    const forged = await forger.add(
      CONVERSATION,
      [await carol.createKeyPackage()],
      sent,
    );
    await carol.learnGenesis(GENESIS);

    await expect(
      carol.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('bob'),
      ),
    ).rejects.toThrow('The welcome roster names another creator');
    expect(await carol.devices(CONVERSATION)).toEqual([]);
  });

  it('rejects a welcome sent in the name of a manager who did not sign it', async () => {
    const forger = engine('dave');
    const bob = engine('bob');
    await forger.createGroup(CONVERSATION, forgedBy('dave'));
    const forged = await forger.add(
      CONVERSATION,
      [await bob.createKeyPackage()],
      sent,
    );

    await expect(
      bob.join(
        CONVERSATION,
        forged.welcome!,
        forged.generation.index,
        id('alice'),
      ),
    ).rejects.toThrow('The welcome is not from a member who may add devices');
  });

  describe('checks a welcome against the roster it carries', () => {
    /** A group built without the engine's policy, as a patched client would. */
    const forge = async (
      by: string,
      context: MlsContextExtension[],
      joiners: string[],
      supports: number[] = [GroupMailboxRosterExtension.EXTENSION_TYPE],
    ): Promise<Uint8Array> => {
      const anything: MlsMembershipPolicy = {
        admits: () => true,
        allows: () => true,
        frontier: () => [],
        priority: () => 0,
        reach: () => 0,
        withheld: () => false,
      };
      const group = await MlsGroup.create(
        CONVERSATION,
        await MlsKeyPackage.generate(cast[by].signer(), supports),
        anything,
        context,
      );
      const keyPackages = await Promise.all(
        joiners.map(async (name) =>
          name === 'bob'
            ? await bob.createKeyPackage()
            : (await MlsKeyPackage.generate(cast[name].signer(), supports))
                .publicBytes,
        ),
      );

      return (await group.add(keyPackages)).welcome!;
    };
    const carrying = (fields: GroupMailboxRoster): MlsContextExtension[] => [
      GroupMailboxRosterContext.extension(fields),
    ];
    let bob: GroupMailboxMlsEngine;

    beforeEach(async () => {
      bob = engine('bob');
      await bob.learnGenesis(GENESIS);
    });

    it.each([
      ['The welcome carries no roster', () => forge('alice', [], ['bob'])],
      [
        'The welcome is for another conversation',
        () =>
          forge(
            'alice',
            carrying(
              rosterOf(NAMES.map(id), {
                conversationId: new ConversationIdFactory()
                  .createGroup(
                    ConversationParticipantId.fromString(id('alice')),
                    ConversationNetworkId.fromString(NETWORK),
                    ConversationGroupNonce.fromString('nonce-2'),
                  )
                  .toString(),
              }),
            ),
            ['bob'],
          ),
      ],
      [
        'The welcome roster does not list this identity',
        () =>
          forge(
            'alice',
            carrying(
              rosterOf([id('alice'), id('carol')], {
                conversationId: CONVERSATION,
              }),
            ),
            ['bob'],
          ),
      ],
      [
        'Welcome tree holds a non-member',
        () =>
          forge(
            'alice',
            carrying(
              rosterOf([id('alice'), id('bob')], {
                conversationId: CONVERSATION,
              }),
            ),
            ['bob', 'carol'],
          ),
      ],
      [
        'The welcome roster names another creator',
        () => forge('dave', carrying(forgedBy('dave')), ['bob']),
      ],
      [
        'The welcome is not from a member who may add devices',
        () => forge('dave', carrying(managedByAlice()), ['bob']),
      ],
    ])('rejects a welcome: %s', async (message, welcome) => {
      const bytes = await welcome();
      const inviter = message.includes('may add') ? id('dave') : id('alice');

      await expect(bob.join(CONVERSATION, bytes, 1, inviter)).rejects.toThrow(
        new MlsRejectedError(message),
      );
      expect(await bob.devices(CONVERSATION)).toEqual([]);
    });

    it('rejects a welcome into a group with a leaf that does not support the roster', async () => {
      const bytes = await forge(
        'alice',
        carrying(managedByAlice()),
        ['bob'],
        [],
      );

      await expect(
        bob.join(CONVERSATION, bytes, 1, id('alice')),
      ).rejects.toThrow('A welcomed leaf does not support the roster');
    });

    it('joins from a welcome that passes every check', async () => {
      const bytes = await forge('alice', carrying(managedByAlice()), ['bob']);

      await bob.join(CONVERSATION, bytes, 1, id('alice'));

      expect((await bob.roster(CONVERSATION))?.toFields()).toEqual(
        managedByAlice().toFields(),
      );
    });
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
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a welcome of its own identity into a group nobody else is in', async () => {
    // A revoked device keeps the identity key and could make such a group.
    const revoked = engine('bob', {
      device: 'd9',
      verified: () => ['d2', 'd9'],
    });
    const phone = engine('bob', { device: 'd2' });
    await revoked.createGroup(CONVERSATION, forgedBy('bob'));
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

  it('rejects a welcome of its own identity from a device its signed transitions no longer authorize', async () => {
    // The revoked laptop still holds the identity key and still believes
    // itself current; it builds a look-alike group with someone else in it.
    const revoked = engine('bob', {
      device: 'd9',
      verified: () => ['d2', 'd9'],
    });
    const phone = engine('bob', { device: 'd2' });
    await revoked.createGroup(CONVERSATION, forgedBy('bob'));
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
      await alice.createGroup(CONVERSATION, roster);
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
    await phone.createGroup(CONVERSATION, roster);
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
    const removal = await drop(laptop, 'carol');

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
    const removal = await drop(laptop, 'carol');

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
    await laptop.createGroup(CONVERSATION, roster);
    await join(laptop, [engine('bob'), engine('carol')]);
    const publish = jest.fn(sent);
    current = ['d1'];

    await expect(drop(laptop, 'carol', publish)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
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
    const removal = await drop(alice, 'carol');
    await carol.applyCommit(CONVERSATION, removal!.commit);
    // Dave races a same-id group of his own past carol's epoch.
    const forger = engine('dave');
    await forger.createGroup(CONVERSATION, forgedBy('dave'));
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
      ).rejects.toThrow('The welcome roster names another creator');
    }
    await expect(
      carol.encrypt(CONVERSATION, text.encode('let me back in')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('refuses to add a device whose key package names another identity', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION, roster);
    // Bob's key signs a credential that claims a device of carol.
    const forged = await MlsKeyPackage.generate(
      new MlsLeafSigner(
        cast.carol.owner('d9'),
        cast.bob.keyPair,
        cast.carol.deviceKeyPair('d9'),
      ),
    );

    await expect(
      alice.add(CONVERSATION, [forged.publicBytes], sent),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect(await alice.members(CONVERSATION)).toEqual([id('alice')]);
  });

  it('refuses to add or remove a member when the roster does not let this member', async () => {
    const { bob } = await setup(['alice', 'bob', 'carol']);
    const publish = jest.fn(sent);

    await expect(
      bob.add(CONVERSATION, [await engine('dave').createKeyPackage()], publish),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(drop(bob, 'carol', publish)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("lets an admin's removal of a member win the epoch over that member's own commit with a lower id", async () => {
    roster = bobAdministers();
    const { alice, bob, carol, dave } = await setup([
      'alice',
      'bob',
      'carol',
      'dave',
    ]);
    const phone = await engine('carol', { device: 'd2' }).createKeyPackage();
    const removal = await ground(
      (publish) => drop(bob, 'carol', publish),
      high,
    );
    // Carol, about to be removed, grinds her own commit below the removal.
    const own = await ground(
      (publish) => carol.add(CONVERSATION, [phone], publish),
      (commitId) => commitId < removal.id,
    );

    expect((await alice.applyCommit(CONVERSATION, own.commit)).kind).toBe(
      'applied',
    );
    expect(await alice.applyCommit(CONVERSATION, removal.commit)).toMatchObject(
      { discardedCommitId: own.id, kind: 'replaced' },
    );
    expect((await dave.applyCommit(CONVERSATION, removal.commit)).kind).toBe(
      'applied',
    );
    expect(await dave.applyCommit(CONVERSATION, own.commit)).toEqual({
      kind: 'ignored',
      reason: 'lost-race',
    });
    expect((await carol.applyCommit(CONVERSATION, removal.commit)).kind).toBe(
      'removed',
    );
    for (const member of [alice, bob, dave]) {
      expect(await member.members(CONVERSATION)).toEqual(
        ['alice', 'bob', 'dave'].map(id).sort(),
      );
    }
  });

  it("lets the creator's commit win the epoch over an admin's with a lower id", async () => {
    roster = bobAdministers();
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const eve = await engine('eve').createKeyPackage();
    const dave = await engine('dave').createKeyPackage();
    const fromAlice = await ground(
      (publish) => alice.add(CONVERSATION, [eve], publish),
      high,
    );
    const fromBob = await ground(
      (publish) => bob.add(CONVERSATION, [dave], publish),
      (commitId) => commitId < fromAlice.id,
    );

    expect(await alice.applyCommit(CONVERSATION, fromBob.commit)).toEqual({
      kind: 'ignored',
      reason: 'lost-race',
    });
    expect(await bob.applyCommit(CONVERSATION, fromAlice.commit)).toMatchObject(
      { discardedCommitId: fromBob.id, kind: 'replaced' },
    );
    await carol.applyCommit(CONVERSATION, fromBob.commit);
    expect(
      await carol.applyCommit(CONVERSATION, fromAlice.commit),
    ).toMatchObject({ discardedCommitId: fromBob.id, kind: 'replaced' });
    for (const member of [alice, bob, carol]) {
      expect(await member.members(CONVERSATION)).toEqual(
        ['alice', 'bob', 'carol', 'eve'].map(id).sort(),
      );
    }
  });

  it('lets the lower commit id win between rivals of equal rank, also over an admin', async () => {
    roster = bobAdministers();
    const { alice, bob, carol, dave } = await setup([
      'alice',
      'bob',
      'carol',
      'dave',
    ]);
    const bobPhone = await engine('bob', { device: 'd2' }).createKeyPackage();
    const carolPhone = await engine('carol', {
      device: 'd2',
    }).createKeyPackage();
    const fromBob = await ground(
      (publish) => bob.add(CONVERSATION, [bobPhone], publish),
      high,
    );
    const fromCarol = await ground(
      (publish) => carol.add(CONVERSATION, [carolPhone], publish),
      (commitId) => commitId < fromBob.id,
    );

    await alice.applyCommit(CONVERSATION, fromBob.commit);
    expect(
      await alice.applyCommit(CONVERSATION, fromCarol.commit),
    ).toMatchObject({ discardedCommitId: fromBob.id, kind: 'replaced' });
    await dave.applyCommit(CONVERSATION, fromCarol.commit);
    expect(await dave.applyCommit(CONVERSATION, fromBob.commit)).toEqual({
      kind: 'ignored',
      reason: 'lost-race',
    });
    expect(await bob.applyCommit(CONVERSATION, fromCarol.commit)).toMatchObject(
      { discardedCommitId: fromBob.id, kind: 'replaced' },
    );
    expect(await bob.devices(CONVERSATION)).toEqual([
      cast.bob.deviceCredential('d1'),
    ]);
    expect(await carol.devices(CONVERSATION)).toEqual(
      [
        cast.carol.deviceCredential('d1'),
        cast.carol.deviceCredential('d2'),
      ].sort(),
    );
    const sealed = await carol.encrypt(CONVERSATION, text.encode('carol won'));

    for (const member of [alice, bob, dave]) {
      expect(read((await member.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
        'carol won',
      );
    }
  });

  it('converges on the removal among three rivals in every arrival order', async () => {
    roster = bobAdministers();
    const alice = engine('alice');
    const bob = engine('bob');
    const carol = engine('carol');
    const dave = engine('dave');
    // Eve's devices only receive; with alice, one per arrival order.
    const receivers = [
      alice,
      ...['d1', 'd2', 'd3', 'd4', 'd9'].map((device) =>
        engine('eve', { device }),
      ),
    ];
    await alice.createGroup(CONVERSATION, roster);
    await join(alice, [bob, carol, dave, ...receivers.slice(1)]);
    const carolPhone = await engine('carol', {
      device: 'd2',
    }).createKeyPackage();
    const davePhone = await engine('dave', { device: 'd2' }).createKeyPackage();
    const removal = await ground(
      (publish) => drop(bob, 'carol', publish),
      high,
    );
    // Both rivals hold lower ids than the removal.
    const rivals = [
      removal,
      await ground(
        (publish) => carol.add(CONVERSATION, [carolPhone], publish),
        (commitId) => commitId < removal.id,
      ),
      await ground(
        (publish) => dave.add(CONVERSATION, [davePhone], publish),
        (commitId) => commitId < removal.id,
      ),
    ];
    const sealed = await bob.encrypt(CONVERSATION, text.encode('bob won'));
    const orders = ordersOf(rivals);

    expect(orders).toHaveLength(receivers.length);
    for (const [index, receiver] of receivers.entries()) {
      for (const { commit } of orders[index]) {
        await receiver.applyCommit(CONVERSATION, commit);
      }

      expect(await receiver.members(CONVERSATION)).toEqual(
        ['alice', 'bob', 'dave', 'eve'].map(id).sort(),
      );
      expect(
        read((await receiver.decrypt(CONVERSATION, sealed)).plaintext),
      ).toBe('bob won');
    }
  });

  it('lets a removed device join again from a new welcome only', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION, roster);
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
    const removal = await drop(alice, 'bob');
    await bob.applyCommit(CONVERSATION, removal!.commit);
    // A removed member comes back on the roster first, then by its leaves.
    await alice.changeRoster(
      CONVERSATION,
      (await alice.roster(CONVERSATION))!.withMember(id('bob'))!,
      sent,
    );

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
    const dave = engine('dave');
    await dave.createGroup(CONVERSATION, forgedBy('dave'));
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
    const removal = await drop(alice, 'carol');
    const tampered = new Uint8Array(removal!.commit);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] + 1) % 256;

    await expect(
      bob.applyCommit(CONVERSATION, tampered),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await bob.generation(CONVERSATION)).index).toBe(before.index);
  });

  it('keeps a removed member unable to send after a restart', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION, roster);
    const carol = engine('carol', { databaseName: 'carol-restart' });
    await join(alice, [carol]);
    const joined = await carol.generation(CONVERSATION);
    const removal = await drop(alice, 'carol');
    await carol.applyCommit(CONVERSATION, removal!.commit);
    const restarted = engine('carol', { databaseName: 'carol-restart' });

    await expect(
      restarted.encrypt(CONVERSATION, text.encode('still here?')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await restarted.generation(CONVERSATION)).index).toBe(joined.index);
  });

  it('rejects a replayed welcome, also after the member was removed', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION, roster);
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
    const removal = await drop(alice, 'bob');
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
    await alice.createGroup(CONVERSATION, roster);

    await expect(
      alice.add(CONVERSATION, [await engine('eve').createKeyPackage()], sent),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('advances the generation on a commit that only changes the roster', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const before = await alice.generation(CONVERSATION);
    const promoted = (await alice.roster(CONVERSATION))!.promoted(id('bob'))!;

    const change = await alice.changeRoster(CONVERSATION, promoted, sent);
    for (const member of [bob, carol]) {
      await member.applyCommit(CONVERSATION, change.commit);
    }

    expect(change.generation.index).toBe(before.index + 1);
    for (const member of [alice, bob, carol]) {
      expect((await member.generation(CONVERSATION)).index).toBe(
        before.index + 1,
      );
      expect((await member.roster(CONVERSATION))!.isAdmin(id('bob'))).toBe(
        true,
      );
    }
  });

  it.each([
    ['another creator', () => forgedBy('bob')],
    ['another conversation', () => rosterOf(NAMES.map(id))],
  ])('creates no group under a roster with %s', async (_case, other) => {
    await expect(
      engine('alice').createGroup(CONVERSATION, other()),
    ).rejects.toThrow('The roster is not one this device creates');
  });

  it('creates a group only once on a device', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION, roster);

    await expect(alice.createGroup(CONVERSATION, roster)).rejects.toThrow(
      'Group already exists on this device',
    );
  });

  it('rejects a roster the library refuses to encode at creation, and creates no group', async () => {
    const alice = engine('alice');
    const encode = jest
      .spyOn(GroupMailboxRosterExtension, 'encode')
      .mockImplementationOnce(() => {
        throw new InvalidMlsExtensionError();
      });

    try {
      await expect(
        alice.createGroup(CONVERSATION, roster),
      ).rejects.toBeInstanceOf(MlsRejectedError);
    } finally {
      encode.mockRestore();
    }

    await expect(
      alice.createGroup(CONVERSATION, roster),
    ).resolves.toBeInstanceOf(GroupMailboxGeneration);
  });

  it('still reads a message a remaining member sent in the epoch before a removal', async () => {
    const { alice, bob } = await setup(['alice', 'bob', 'carol']);
    const inFlight = await bob.encrypt(CONVERSATION, text.encode('in flight'));

    await drop(alice, 'carol');

    expect(read((await alice.decrypt(CONVERSATION, inFlight)).plaintext)).toBe(
      'in flight',
    );
  });

  it('keeps retired generations readable for the drain window only', async () => {
    const { alice } = await setup(['alice', 'bob', 'carol']);

    await drop(alice, 'carol');

    expect(await indices(alice)).toEqual([2, 1, 0]);
    clock += GroupMailboxGeneration.DRAIN_WINDOW_MS + 1;
    expect(await indices(alice)).toEqual([2]);
  });

  it('restores group state and generations in a new engine instance', async () => {
    const alice = engine('alice', { databaseName: 'alice-restore' });
    await alice.createGroup(CONVERSATION, roster);
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

  describe('commits an update of its own leaf on a cadence', () => {
    const DUE = MlsUpdateCadence.INTERVAL_MS + MlsUpdateCadence.JITTER_MS + 1;
    const anything: MlsMembershipPolicy = {
      admits: () => true,
      allows: () => true,
      frontier: () => [],
      priority: () => 0,
      reach: () => 0,
      withheld: () => false,
    };

    /** Alice and bob, bob on a store the test reads as a thief would. */
    const withBob = async () => {
      const stores = sealedGroupStores(`group-mls-${++database}`, id('bob'));
      const alice = engine('alice');
      const bob = engine('bob', {
        generations: stores.generations,
        store: stores.state,
      });

      await alice.createGroup(CONVERSATION, roster);
      await join(alice, [bob]);

      return { alice, bob, store: stores.state };
    };

    /** Bob's group as it is stored now, copied by whoever leaked it. */
    const leakedFrom = async (store: MlsStateStore): Promise<MlsGroup> =>
      MlsGroup.restore(
        CONVERSATION,
        cast.bob.owner(),
        anything,
        (await store.loadGroup(CONVERSATION))!,
        [],
      );

    /** The leaked copy follows bob's update and reads alice's next message. */
    const expectLockedOut = async (
      leaked: MlsGroup,
      alice: GroupMailboxMlsEngine,
      update: GroupMailboxCommit,
    ): Promise<void> => {
      await leaked
        .applyCommit({
          bytes: update.commit,
          epoch: MlsGroup.epochOf(update.commit),
          id: commitIdOf(update.commit),
        })
        .catch(() => undefined);
      const after = await alice.encrypt(CONVERSATION, text.encode('after'));

      await expect(leaked.decrypt(after)).rejects.toThrow();
    };

    it('commits one update once a day has passed, which the others apply and a leaked copy cannot follow', async () => {
      const { alice, bob, store } = await withBob();
      const leaked = await leakedFrom(store);
      const before = await bob.generation(CONVERSATION);

      expect(await bob.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
      clock += DUE;
      const update = await bob.updateWhenDue(CONVERSATION, sent);

      expect(update!.deliveryGeneration.index).toBe(before.index);
      expect(update!.generation.index).toBe(before.index + 1);
      expect(update!.recipients).toEqual([id('alice'), id('bob')].sort());
      expect(await bob.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
      expect((await alice.applyCommit(CONVERSATION, update!.commit)).kind).toBe(
        'applied',
      );
      expect(
        (await alice.generation(CONVERSATION)).secret.isEqual(
          update!.generation.secret,
        ),
      ).toBe(true);
      await expectLockedOut(leaked, alice, update!);
    });

    it('commits one update once it sent a thousand messages since the last', async () => {
      const { alice, bob, store } = await withBob();
      const leaked = await leakedFrom(store);

      for (let count = 1; count < MlsUpdateCadence.MAX_SENT; count += 1) {
        await bob.encrypt(CONVERSATION, text.encode('chatter'));
      }

      expect(await bob.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
      await bob.encrypt(CONVERSATION, text.encode('the thousandth'));
      const update = await bob.updateWhenDue(CONVERSATION, sent);

      expect(update).toBeDefined();
      await alice.applyCommit(CONVERSATION, update!.commit);
      await expectLockedOut(leaked, alice, update!);
    }, 120_000);

    it('keeps the creator update of two rivals on both and updates again when its own lost', async () => {
      const { alice, bob } = await withBob();

      clock += DUE;
      const fromAlice = await alice.updateWhenDue(CONVERSATION, sent);
      const fromBob = await bob.updateWhenDue(CONVERSATION, sent);

      expect(
        (await bob.applyCommit(CONVERSATION, fromAlice!.commit)).kind,
      ).toBe('replaced');
      expect(
        (await alice.applyCommit(CONVERSATION, fromBob!.commit)).kind,
      ).toBe('ignored');
      expect(
        (await bob.generation(CONVERSATION)).secret.isEqual(
          (await alice.generation(CONVERSATION)).secret,
        ),
      ).toBe(true);
      expect(await alice.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
      const again = await bob.updateWhenDue(CONVERSATION, sent);

      expect((await alice.applyCommit(CONVERSATION, again!.commit)).kind).toBe(
        'applied',
      );
    });

    it('restarts the cadence on a removal it commits, but not on an add', async () => {
      const { alice } = await setup(['alice', 'bob']);
      const carol = engine('carol');

      clock += DUE;
      await join(alice, [carol]);

      expect(await alice.updateWhenDue(CONVERSATION, sent)).toBeDefined();
      clock += DUE;
      await drop(alice, 'carol');

      expect(await alice.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
    });

    it('commits no update once removed', async () => {
      const { alice, bob } = await setup(['alice', 'bob']);
      const removal = await drop(alice, 'bob');

      await bob.applyCommit(CONVERSATION, removal.commit);
      clock += DUE;

      expect(await bob.updateWhenDue(CONVERSATION, sent)).toBeUndefined();
    });
  });

  describe('confirming a welcomed group', () => {
    /**
     * Alice creates the group under a roster that lets every member add,
     * bob joins from alice knowing the genesis, and bob then welcomes
     * carol, who knows only what `carol` brings.
     */
    const welcomedByBob = async (carol: GroupMailboxMlsEngine) => {
      roster = bobAdministers();
      const alice = engine('alice');
      const bob = engine('bob');
      await alice.createGroup(CONVERSATION, roster);
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
      await alice.createGroup(CONVERSATION, roster);

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
      await alice.createGroup(CONVERSATION, roster);
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
      roster = bobAdministers();
      const alice = engine('alice');
      const bob = engine('bob');
      const dave = engine('dave');
      const davePhone = engine('dave', { device: 'd2' });
      const carol = engine('carol', { contacts: () => [id('dave')] });
      await alice.createGroup(CONVERSATION, roster);
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
      roster = bobAdministers();
      const alice = engine('alice');
      const bob = engine('bob');
      const dave = engine('dave');
      const carol = engine('carol', {
        contacts: () => [id('bob'), id('dave')],
      });
      await alice.createGroup(CONVERSATION, roster);
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
      await alice.createGroup(CONVERSATION, roster);
      const restarted = engine('alice', { databaseName });

      expect(await restarted.awaitsConfirmation(CONVERSATION)).toBe(true);
      await expect(
        restarted.encrypt(CONVERSATION, text.encode('old group')),
      ).rejects.toBeInstanceOf(GroupMailboxUnconfirmedError);
    });
  });
});
