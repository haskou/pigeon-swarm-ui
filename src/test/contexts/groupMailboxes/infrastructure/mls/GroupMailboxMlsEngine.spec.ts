import 'fake-indexeddb/auto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxGenerationRepository } from '../../../../../contexts/groupMailboxes/domain/repositories/GroupMailboxGenerationRepository';

import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { sealedGroupStores } from '../sealedGroupStores';

const text = new TextEncoder();
const read = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const CONVERSATION = 'conversation-1';

let roster: ReadonlySet<string> = new Set();
let clock = 0;
let database = 0;

const engine = (
  identityId: string,
  deviceId = 'd1',
  databaseName = `group-mls-${++database}`,
  generations?: GroupMailboxGenerationRepository,
  store?: MlsStateStore,
): GroupMailboxMlsEngine =>
  new GroupMailboxMlsEngine(
    { deviceId, identityId },
    store ?? sealedGroupStores(databaseName, identityId).state,
    generations ?? sealedGroupStores(databaseName, identityId).generations,
    () => Promise.resolve(roster),
    () => clock,
  );

/** The real store, whose writes a test can make fail once. */
const flakyStore = (
  databaseName: string,
  identityId: string,
): MockProxy<MlsStateStore> => {
  const backing = sealedGroupStores(databaseName, identityId).state;
  const store = mock<MlsStateStore>();

  store.deleteKeyPackage.mockImplementation((id) =>
    backing.deleteKeyPackage(id),
  );
  store.loadGroup.mockImplementation((id) => backing.loadGroup(id));
  store.loadKeyPackages.mockImplementation(() => backing.loadKeyPackages());
  store.loadPlaintext.mockImplementation((id, ciphertextId) =>
    backing.loadPlaintext(id, ciphertextId),
  );
  store.saveGroup.mockImplementation((id, state) =>
    backing.saveGroup(id, state),
  );
  store.saveKeyPackage.mockImplementation((keyPackage) =>
    backing.saveKeyPackage(keyPackage),
  );
  store.savePlaintext.mockImplementation((id, ciphertextId, plaintext) =>
    backing.savePlaintext(id, ciphertextId, plaintext),
  );

  return store;
};

const join = async (
  creator: GroupMailboxMlsEngine,
  joiners: GroupMailboxMlsEngine[],
): Promise<void> => {
  const added = await creator.add(
    CONVERSATION,
    await Promise.all(joiners.map((joiner) => joiner.createKeyPackage())),
  );
  for (const joiner of joiners) {
    await joiner.join(CONVERSATION, added.welcome!, added.generation.index);
  }
};

const setup = async (
  names: string[],
): Promise<Record<string, GroupMailboxMlsEngine>> => {
  const engines = Object.fromEntries(names.map((name) => [name, engine(name)]));
  const [creator, ...joiners] = names;
  await engines[creator].createGroup(CONVERSATION);
  await join(
    engines[creator],
    joiners.map((name) => engines[name]),
  );

  return engines;
};

const indices = async (member: GroupMailboxMlsEngine): Promise<number[]> =>
  (await member.readableGenerations(CONVERSATION)).map(({ index }) => index);

describe('GroupMailboxMlsEngine on the real ts-mls library', () => {
  beforeEach(() => {
    roster = new Set(['alice', 'bob', 'carol', 'dave']);
    clock = 1_000;
  });

  it('exports gen_0 at creation and lets every joiner export the generation of its welcome itself', async () => {
    const alice = engine('alice');
    const created = await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, added.welcome!, added.generation.index);

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

    const added = await alice.add(CONVERSATION, [
      await carol.createKeyPackage(),
    ]);
    await bob.applyCommit(CONVERSATION, added.commit);
    await carol.join(CONVERSATION, added.welcome!, added.generation.index);

    expect(added.generation.index).toBe(before.index + 1);
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

    const removal = await alice.remove(CONVERSATION, ['carol']);
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

    await alice.remove(CONVERSATION, ['carol']);

    await expect(alice.decrypt(CONVERSATION, late)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
    await expect(alice.decrypt(CONVERSATION, late)).rejects.toBeInstanceOf(
      MlsRejectedError,
    );
  });

  it('still advances the generation when saving the log failed the first time', async () => {
    const generations = mock<GroupMailboxGenerationRepository>();
    const backing = sealedGroupStores(`flaky-${++database}`, 'bob').generations;
    generations.load.mockImplementation((id) => backing.load(id));
    generations.save.mockImplementation((id, log) => backing.save(id, log));
    const alice = engine('alice');
    const bob = engine('bob', 'd1', `flaky-bob-${database}`, generations);
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const removal = await alice.remove(CONVERSATION, ['carol']);
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

  it('keeps its own removal uncommitted when saving the log fails', async () => {
    const generations = mock<GroupMailboxGenerationRepository>();
    const backing = sealedGroupStores(
      `flaky-${++database}`,
      'alice',
    ).generations;
    generations.load.mockImplementation((id) => backing.load(id));
    generations.save.mockImplementation((id, log) => backing.save(id, log));
    const alice = engine('alice', 'd1', `flaky-alice-${database}`, generations);
    const bob = engine('bob');
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    const before = await alice.generation(CONVERSATION);
    generations.save.mockRejectedValueOnce(new Error('quota'));

    await expect(alice.remove(CONVERSATION, ['carol'])).rejects.toThrow();
    const removal = await alice.remove(CONVERSATION, ['carol']);
    await bob.applyCommit(CONVERSATION, removal!.commit);

    expect(removal!.generation.index).toBe(before.index + 1);
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
  });

  it('keeps the generation of the commit it publishes when saving its group failed after the log', async () => {
    const name = `flaky-group-${++database}`;
    const store = flakyStore(name, 'alice');
    const alice = engine('alice', 'd1', name, undefined, store);
    const bob = engine('bob');
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    await join(alice, [bob, carol]);
    store.saveGroup.mockRejectedValueOnce(new Error('quota'));

    await expect(alice.remove(CONVERSATION, ['carol'])).rejects.toThrow();
    const removal = await alice.remove(CONVERSATION, ['carol']);
    await bob.applyCommit(CONVERSATION, removal!.commit);
    const published = await bob.generation(CONVERSATION);

    expect(removal!.generation.secret.isEqual(published.secret)).toBe(true);
    expect(
      (await alice.generation(CONVERSATION)).secret.isEqual(published.secret),
    ).toBe(true);
  });

  it('never exposes the generation of an add that died before its group was saved', async () => {
    const name = `flaky-add-${++database}`;
    const store = flakyStore(name, 'alice');
    const alice = engine('alice', 'd1', name, undefined, store);
    const carol = engine('carol');
    await alice.createGroup(CONVERSATION);
    const before = await alice.generation(CONVERSATION);
    const keyPackage = await carol.createKeyPackage();
    store.saveGroup.mockRejectedValueOnce(new Error('crash'));

    await expect(alice.add(CONVERSATION, [keyPackage])).rejects.toThrow();
    const restarted = engine('alice', 'd1', name);
    expect(
      (await restarted.generation(CONVERSATION)).secret.isEqual(before.secret),
    ).toBe(true);
    const added = await restarted.add(CONVERSATION, [keyPackage]);
    await carol.join(CONVERSATION, added.welcome!, added.generation.index);

    expect(
      (await carol.generation(CONVERSATION)).secret.isEqual(
        (await restarted.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
  });

  it('keeps the key package when saving the joined group fails', async () => {
    const name = `flaky-join-${++database}`;
    const store = flakyStore(name, 'bob');
    const alice = engine('alice');
    const bob = engine('bob', 'd1', name, undefined, store);
    await alice.createGroup(CONVERSATION);
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    store.saveGroup.mockRejectedValueOnce(new Error('quota'));

    await expect(
      bob.join(CONVERSATION, added.welcome!, added.generation.index),
    ).rejects.toThrow();
    await bob.join(CONVERSATION, added.welcome!, added.generation.index);

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
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);

    for (const index of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        bob.join(CONVERSATION, added.welcome!, index),
      ).rejects.toBeInstanceOf(MlsRejectedError);
    }
    await bob.join(CONVERSATION, added.welcome!, added.generation.index);

    expect((await bob.generation(CONVERSATION)).index).toBe(
      added.generation.index,
    );
  });

  it('lets a removed device join again from a new welcome only', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const first = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, first.welcome!, first.generation.index);
    const removal = await alice.remove(CONVERSATION, ['bob']);
    await bob.applyCommit(CONVERSATION, removal!.commit);

    const again = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, again.welcome!, again.generation.index);
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
      bob.join(CONVERSATION, first.welcome!, first.generation.index),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('names the authenticated MLS sender of every message', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);

    const sealed = await bob.encrypt(CONVERSATION, text.encode('from bob'));
    const opened = await alice.decrypt(CONVERSATION, sealed);

    expect(opened.sender).toEqual({ deviceId: 'd1', identityId: 'bob' });
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
    expect(own.sender).toEqual({ deviceId: 'd1', identityId: 'alice' });
    expect(read(own.plaintext)).toBe('again');
  });

  it('rejects a commit forged in another group and keeps its generation', async () => {
    const { alice } = await setup(['alice', 'bob']);
    const before = await alice.generation(CONVERSATION);
    const dave = engine('dave');
    await dave.createGroup(CONVERSATION);
    const forged = await dave.add(CONVERSATION, [
      await engine('carol').createKeyPackage(),
    ]);

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
    const removal = await alice.remove(CONVERSATION, ['carol']);
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
    const carol = engine('carol', 'd1', 'carol-restart');
    await join(alice, [carol]);
    const joined = await carol.generation(CONVERSATION);
    const removal = await alice.remove(CONVERSATION, ['carol']);
    await carol.applyCommit(CONVERSATION, removal!.commit);
    const restarted = engine('carol', 'd1', 'carol-restart');

    await expect(
      restarted.encrypt(CONVERSATION, text.encode('still here?')),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await restarted.generation(CONVERSATION)).index).toBe(joined.index);
  });

  it('rejects a replayed welcome, also after the member was removed', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    const { index } = added.generation;
    await bob.join(CONVERSATION, added.welcome!, index);

    await expect(
      bob.join(CONVERSATION, added.welcome!, index),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    const removal = await alice.remove(CONVERSATION, ['bob']);
    await bob.applyCommit(CONVERSATION, removal!.commit);
    await expect(
      bob.join(CONVERSATION, added.welcome!, index),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(
      engine('carol').join(CONVERSATION, added.welcome!, index),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('refuses to add an identity the conversation roster does not list', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);

    await expect(
      alice.add(CONVERSATION, [await engine('eve').createKeyPackage()]),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('still reads a message a remaining member sent in the epoch before a removal', async () => {
    const { alice, bob } = await setup(['alice', 'bob', 'carol']);
    const inFlight = await bob.encrypt(CONVERSATION, text.encode('in flight'));

    await alice.remove(CONVERSATION, ['carol']);

    expect(read((await alice.decrypt(CONVERSATION, inFlight)).plaintext)).toBe(
      'in flight',
    );
  });

  it('keeps retired generations readable for the drain window only', async () => {
    const { alice } = await setup(['alice', 'bob', 'carol']);

    await alice.remove(CONVERSATION, ['carol']);

    expect(await indices(alice)).toEqual([2, 1, 0]);
    clock += GroupMailboxGeneration.DRAIN_WINDOW_MS + 1;
    expect(await indices(alice)).toEqual([2]);
  });

  it('restores group state and generations in a new engine instance', async () => {
    const alice = engine('alice', 'd1', 'alice-restore');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    await join(alice, [bob]);
    const restored = engine('alice', 'd1', 'alice-restore');

    const sealed = await restored.encrypt(CONVERSATION, text.encode('back'));

    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'back',
    );
    expect(
      (await restored.generation(CONVERSATION)).secret.isEqual(
        (await bob.generation(CONVERSATION)).secret,
      ),
    ).toBe(true);
    expect(await restored.members(CONVERSATION)).toEqual(['alice', 'bob']);
  });
});
