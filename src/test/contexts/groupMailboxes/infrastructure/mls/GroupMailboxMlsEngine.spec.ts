import 'fake-indexeddb/auto';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { GroupMailboxMlsEngine } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxMlsEngine';
import { IndexedDbGroupMailboxGenerationStore } from '../../../../../contexts/groupMailboxes/infrastructure/indexeddb/IndexedDbGroupMailboxGenerationStore';

const text = new TextEncoder();
const read = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const CONVERSATION = 'conversation-1';
const DAY = 24 * 60 * 60 * 1000;

let roster: ReadonlySet<string> = new Set();
let clock = 0;
let database = 0;

const engine = (
  identityId: string,
  deviceId = 'd1',
  databaseName = `group-mls-${++database}`,
): GroupMailboxMlsEngine =>
  new GroupMailboxMlsEngine(
    { deviceId, identityId },
    new IndexedDbMlsStateStore(`${databaseName}-mls`, identityId),
    new IndexedDbGroupMailboxGenerationStore(
      `${databaseName}-generations`,
      identityId,
    ),
    async () => roster,
    () => clock,
  );

const setup = async (
  names: string[],
): Promise<Record<string, GroupMailboxMlsEngine>> => {
  const engines = Object.fromEntries(names.map((name) => [name, engine(name)]));
  const [creator, ...joiners] = names;
  await engines[creator].createGroup(CONVERSATION);
  const keyPackages = await Promise.all(
    joiners.map((name) => engines[name].createKeyPackage()),
  );
  const added = await engines[creator].add(CONVERSATION, keyPackages);
  for (const name of joiners) {
    await engines[name].join(CONVERSATION, added.welcome!, added.generation);
  }

  return engines;
};

describe('GroupMailboxMlsEngine on the real ts-mls library', () => {
  beforeEach(() => {
    roster = new Set(['alice', 'bob', 'carol', 'dave']);
    clock = 1_000;
  });

  it('exports gen_0 at creation and hands the same generation to every joiner', async () => {
    const alice = engine('alice');
    const created = await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, added.welcome!, added.generation);

    const shared = await bob.generation(CONVERSATION);

    expect(created.index).toBe(0);
    expect(added.generation.index).toBe(0);
    expect(added.generation.secret.isEqual(created.secret)).toBe(true);
    expect(shared.index).toBe(0);
    expect(shared.secret.isEqual(created.secret)).toBe(true);
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
    expect(removal!.generation.index).toBe(1);
    expect(removal!.generation.secret.isEqual(before.secret)).toBe(false);
    expect(bobOutcome.kind).toBe('applied');
    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(
        removal!.generation.secret,
      ),
    ).toBe(true);
    expect(carolOutcome.kind).toBe('removed');
    expect((await carol.generation(CONVERSATION)).index).toBe(0);
    await expect(
      carol.encrypt(CONVERSATION, text.encode('x')),
    ).rejects.toThrow();
    await expect(carol.decrypt(CONVERSATION, sealed)).rejects.toThrow();
    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'after carol left',
    );
  });

  it('keeps the generation when a member is only added', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const before = await bob.generation(CONVERSATION);
    const carol = engine('carol');

    const added = await alice.add(CONVERSATION, [
      await carol.createKeyPackage(),
    ]);
    await bob.applyCommit(CONVERSATION, added.commit);

    expect(
      (await bob.generation(CONVERSATION)).secret.isEqual(before.secret),
    ).toBe(true);
    expect(added.generation.index).toBe(0);
  });

  it('names the authenticated MLS sender of every message', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);

    const sealed = await bob.encrypt(CONVERSATION, text.encode('from bob'));
    const opened = await alice.decrypt(CONVERSATION, sealed);

    expect(opened.sender).toEqual({ deviceId: 'd1', identityId: 'bob' });
    expect(read(opened.plaintext)).toBe('from bob');
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
    const removal = await alice.remove(CONVERSATION, ['carol']);
    const tampered = new Uint8Array(removal!.commit);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] + 1) % 256;

    await expect(
      bob.applyCommit(CONVERSATION, tampered),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    expect((await bob.generation(CONVERSATION)).index).toBe(0);
  });

  it('rejects a replayed welcome, also after the member was removed', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, added.welcome!, added.generation);

    await expect(
      bob.join(CONVERSATION, added.welcome!, added.generation),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    const removal = await alice.remove(CONVERSATION, ['bob']);
    await bob.applyCommit(CONVERSATION, removal!.commit);
    await expect(
      bob.join(CONVERSATION, added.welcome!, added.generation),
    ).rejects.toBeInstanceOf(MlsRejectedError);
    await expect(
      engine('carol').join(CONVERSATION, added.welcome!, added.generation),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('refuses to add an identity the conversation roster does not list', async () => {
    const alice = engine('alice');
    await alice.createGroup(CONVERSATION);

    await expect(
      alice.add(CONVERSATION, [await engine('eve').createKeyPackage()]),
    ).rejects.toBeInstanceOf(MlsRejectedError);
  });

  it('still reads a message sent in the epoch before a removal', async () => {
    const { alice, bob } = await setup(['alice', 'bob', 'carol']);
    const inFlight = await bob.encrypt(CONVERSATION, text.encode('in flight'));

    await alice.remove(CONVERSATION, ['carol']);

    expect(read((await alice.decrypt(CONVERSATION, inFlight)).plaintext)).toBe(
      'in flight',
    );
  });

  it('keeps the retired generation readable for the drain window only', async () => {
    const { alice } = await setup(['alice', 'bob', 'carol']);

    await alice.remove(CONVERSATION, ['carol']);

    expect(
      (await alice.readableGenerations(CONVERSATION)).map(({ index }) => index),
    ).toEqual([1, 0]);
    clock += DAY + 1;
    expect(
      (await alice.readableGenerations(CONVERSATION)).map(({ index }) => index),
    ).toEqual([1]);
  });

  it('restores group state and generations in a new engine instance', async () => {
    const alice = engine('alice', 'd1', 'alice-restore');
    await alice.createGroup(CONVERSATION);
    const bob = engine('bob');
    const added = await alice.add(CONVERSATION, [await bob.createKeyPackage()]);
    await bob.join(CONVERSATION, added.welcome!, added.generation);
    const restored = engine('alice', 'd1', 'alice-restore');

    const sealed = await restored.encrypt(CONVERSATION, text.encode('back'));

    expect(read((await bob.decrypt(CONVERSATION, sealed)).plaintext)).toBe(
      'back',
    );
    expect(
      (await restored.generation(CONVERSATION)).secret.isEqual(
        added.generation.secret,
      ),
    ).toBe(true);
    expect(await restored.members(CONVERSATION)).toEqual(['alice', 'bob']);
  });
});
