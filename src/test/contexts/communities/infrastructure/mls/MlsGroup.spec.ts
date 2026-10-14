import type {
  MlsMembershipChange,
  MlsMembershipPolicy,
} from '../../../../../contexts/communities/infrastructure/mls/MlsMembershipPolicy';

import {
  MlsGroup,
  type MlsCommitOutput,
  type MlsKeyPackageBundle,
  generateMlsKeyPackage,
  mlsKeyPackageOwner,
} from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';
import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { MlsTestIdentity } from './MlsTestIdentity';

const text = new TextEncoder();
const read = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

let cast: Record<string, MlsTestIdentity>;
let members: Set<string>;
let allows: (change: MlsMembershipChange) => boolean;
const policy: MlsMembershipPolicy = {
  admits: (identityId) => members.has(identityId),
  allows: (change) => allows(change),
  frontier: () => [],
  reach: () => 0,
};
const idOf = (name: string): string => cast[name].id;
const idsOf = (...names: string[]): string[] => names.map(idOf).sort();

const device = (name: string, deviceName = 'd1') =>
  generateMlsKeyPackage(cast[name].signer(deviceName));

/** Only alice adds or removes; anyone may rotate their own leaf. */
const aliceManages = ({ added, committer, removed }: MlsMembershipChange) =>
  committer === idOf('alice') || (added.length === 0 && removed.length === 0);

interface Seat {
  key: MlsKeyPackageBundle;
  group: MlsGroup;
}

let commitCounter = 0;
const nextId = (): string => `c${String(++commitCounter).padStart(4, '0')}`;

const admit = async (
  admin: MlsGroup,
  newcomers: MlsKeyPackageBundle[],
  others: MlsGroup[],
): Promise<{ groups: MlsGroup[]; output: MlsCommitOutput }> => {
  const output = await admin.add(newcomers.map((key) => key.publicBytes));
  const id = nextId();
  admin.confirm(id);
  for (const other of others) {
    await other.applyCommit({ bytes: output.commit, epoch: output.epoch, id });
  }
  const groups = await Promise.all(
    newcomers.map((key) =>
      MlsGroup.join(admin.groupId, key, output.welcome!, policy),
    ),
  );

  return { groups, output };
};

const setup = async (names: string[]): Promise<Record<string, Seat>> => {
  const seats: Record<string, Seat> = {};
  const [first, ...rest] = names;
  const firstKey = await device(first);
  seats[first] = {
    group: await MlsGroup.create('community-1', firstKey, policy),
    key: firstKey,
  };
  const keys = await Promise.all(rest.map((name) => device(name)));
  const { groups } = await admit(seats[first].group, keys, []);
  rest.forEach((name, index) => {
    seats[name] = { group: groups[index], key: keys[index] };
  });

  return seats;
};

describe('MlsGroup on the real ts-mls library', () => {
  beforeAll(async () => {
    cast = await MlsTestIdentity.cast([
      'alice',
      'bob',
      'carol',
      'dave',
      'mallory',
    ]);
  });

  beforeEach(() => {
    members = new Set(['alice', 'bob', 'carol', 'dave'].map(idOf));
    allows = () => true;
  });

  it('delivers a message to every member of a multi-user group', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);

    const sealed = await alice.group.encrypt(text.encode('hello everyone'));

    expect(read(await bob.group.decrypt(sealed))).toBe('hello everyone');
    expect(read(await carol.group.decrypt(sealed))).toBe('hello everyone');
    expect(alice.group.identities().sort()).toEqual(
      idsOf('alice', 'bob', 'carol'),
    );
  });

  it('lets a second device of the same identity join and read', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = await device('bob', 'd2');

    const { groups } = await admit(alice.group, [phone], [bob.group]);
    const sealed = await alice.group.encrypt(text.encode('to both devices'));

    expect(read(await groups[0].decrypt(sealed))).toBe('to both devices');
    expect(read(await bob.group.decrypt(sealed))).toBe('to both devices');
    expect(alice.group.identities().sort()).toEqual(idsOf('alice', 'bob'));
    expect(alice.group.leaves()).toHaveLength(3);
  });

  it('exposes the signature public key of every leaf for audit', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const leaves = alice.group.leaves();

    expect(leaves.map(({ owner }) => owner.identityId)).toEqual([
      idOf('alice'),
      idOf('bob'),
    ]);
    expect(leaves[0].signaturePublicKey).toEqual(
      alice.key.publicPackage.leafNode.signaturePublicKey,
    );
    expect(leaves[1].signaturePublicKey).toEqual(
      bob.key.publicPackage.leafNode.signaturePublicKey,
    );
  });

  it('stops a removed member from decrypting what is sent afterwards', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const before = await alice.group.encrypt(text.encode('before'));
    expect(read(await carol.group.decrypt(before))).toBe('before');

    const removal = (await alice.group.removeIdentities([idOf('carol')]))!;
    const id = nextId();
    alice.group.confirm(id);
    await bob.group.applyCommit({
      bytes: removal.commit,
      epoch: removal.epoch,
      id,
    });
    const carolOutcome = await carol.group.applyCommit({
      bytes: removal.commit,
      epoch: removal.epoch,
      id,
    });
    const after = await alice.group.encrypt(text.encode('after'));

    expect(carolOutcome.kind).toBe('removed');
    expect(read(await bob.group.decrypt(after))).toBe('after');
    await expect(carol.group.decrypt(after)).rejects.toThrow();
    await expect(carol.group.encrypt(text.encode('x'))).rejects.toThrow(
      'removed',
    );
    expect(alice.group.identities()).not.toContain(idOf('carol'));
  });

  it('removes every device of an identity at once', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = await device('bob', 'd2');
    const { groups } = await admit(alice.group, [phone], [bob.group]);

    const removal = (await alice.group.removeIdentities([idOf('bob')]))!;
    const id = nextId();
    alice.group.confirm(id);
    const record = { bytes: removal.commit, epoch: removal.epoch, id };

    expect((await bob.group.applyCommit(record)).kind).toBe('removed');
    expect((await groups[0].applyCommit(record)).kind).toBe('removed');
    expect(alice.group.leaves()).toHaveLength(1);
  });

  it('removes only the named devices of an identity', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = await device('bob', 'd2');
    const { groups } = await admit(alice.group, [phone], [bob.group]);

    const removal = (await bob.group.removeDevices(idOf('bob'), [
      cast.bob.deviceCredential('d2'),
    ]))!;
    const id = nextId();
    bob.group.confirm(id);
    const record = { bytes: removal.commit, epoch: removal.epoch, id };
    await alice.group.applyCommit(record);
    const after = await alice.group.encrypt(text.encode('after'));

    expect((await groups[0].applyCommit(record)).kind).toBe('removed');
    expect(read(await bob.group.decrypt(after))).toBe('after');
    expect(
      alice.group.leaves().map(({ owner }) => owner.deviceCredential),
    ).toEqual([
      cast.alice.deviceCredential('d1'),
      cast.bob.deviceCredential('d1'),
    ]);
  });

  it('commits nothing when no named device holds a leaf', async () => {
    const { alice } = await setup(['alice', 'bob']);

    await expect(
      alice.group.removeDevices(idOf('bob'), [cast.bob.deviceCredential('d2')]),
    ).resolves.toBeUndefined();
  });

  it('does not give a member of one group the secret of another group', async () => {
    const community = await setup(['alice', 'bob', 'carol']);
    const aliceChannelKey = await device('alice', 'd3');
    const channel = await MlsGroup.create(
      'community-1:private',
      aliceChannelKey,
      policy,
    );
    const bobChannelKey = await device('bob', 'd3');
    await admit(channel, [bobChannelKey], []);

    const communitySecret = await community.carol.group.exportSecret(
      'pigeon/call-media/v1',
      text.encode('call-1'),
    );
    const channelSecret = await channel.exportSecret(
      'pigeon/call-media/v1',
      text.encode('call-1'),
    );
    const sealedInChannel = await channel.encrypt(text.encode('restricted'));

    expect(
      Buffer.from(communitySecret).equals(Buffer.from(channelSecret)),
    ).toBe(false);
    await expect(
      community.carol.group.decrypt(sealedInChannel),
    ).rejects.toThrow();
  });

  it('derives different secrets per purpose, equal across members of an epoch', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const context = text.encode('call-1');

    const aliceMedia = await alice.group.exportSecret(
      'pigeon/call-media/v1',
      context,
    );
    const bobMedia = await bob.group.exportSecret(
      'pigeon/call-media/v1',
      context,
    );
    const other = await alice.group.exportSecret('pigeon/other/v1', context);
    const otherCall = await alice.group.exportSecret(
      'pigeon/call-media/v1',
      text.encode('call-2'),
    );

    expect(Buffer.from(aliceMedia).equals(Buffer.from(bobMedia))).toBe(true);
    expect(Buffer.from(aliceMedia).equals(Buffer.from(other))).toBe(false);
    expect(Buffer.from(aliceMedia).equals(Buffer.from(otherCall))).toBe(false);
  });

  it('changes the exported secret when the epoch changes', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const context = text.encode('call-1');
    const first = await alice.group.exportSecret(
      'pigeon/call-media/v1',
      context,
    );

    const update = await alice.group.update();
    const id = nextId();
    alice.group.confirm(id);
    await bob.group.applyCommit({
      bytes: update.commit,
      epoch: update.epoch,
      id,
    });
    const second = await alice.group.exportSecret(
      'pigeon/call-media/v1',
      context,
    );

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
    expect(
      Buffer.from(second).equals(
        Buffer.from(
          await bob.group.exportSecret('pigeon/call-media/v1', context),
        ),
      ),
    ).toBe(true);
  });

  it('applies a repeated commit only once and reports a missing one as a gap', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const first = await alice.group.update();
    alice.group.confirm('c-first');
    const second = await alice.group.update();
    alice.group.confirm('c-second');

    const gap = await bob.group.applyCommit({
      bytes: second.commit,
      epoch: second.epoch,
      id: 'c-second',
    });
    const record = { bytes: first.commit, epoch: first.epoch, id: 'c-first' };
    const applied = await bob.group.applyCommit(record);
    const duplicate = await bob.group.applyCommit(record);
    const caughtUp = await bob.group.applyCommit({
      bytes: second.commit,
      epoch: second.epoch,
      id: 'c-second',
    });

    expect(gap.kind).toBe('gap');
    expect(applied.kind).toBe('applied');
    expect(duplicate).toEqual({ kind: 'ignored', reason: 'duplicate' });
    expect(caughtUp.kind).toBe('applied');
    expect(bob.group.epoch).toBe(alice.group.epoch);
  });

  it('converges on the lowest commit id when two members commit the same epoch', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const fromAlice = (await alice.group.removeIdentities([idOf('carol')]))!;
    const fromBob = await bob.group.update();
    const aliceRecord = {
      bytes: fromAlice.commit,
      epoch: fromAlice.epoch,
      id: 'b-alice',
    };
    const bobRecord = {
      bytes: fromBob.commit,
      epoch: fromBob.epoch,
      id: 'a-bob',
    };

    // Each author first assumes it won, then learns about the other commit.
    alice.group.confirm(aliceRecord.id);
    bob.group.confirm(bobRecord.id);
    const aliceSees = await alice.group.applyCommit(bobRecord);
    const bobSees = await bob.group.applyCommit(aliceRecord);
    const carolFirst = await carol.group.applyCommit(aliceRecord);
    const carolThen = await carol.group.applyCommit(bobRecord);

    expect(aliceSees).toMatchObject({
      discardedCommitId: 'b-alice',
      kind: 'replaced',
    });
    expect(bobSees).toEqual({ kind: 'ignored', reason: 'lost-race' });
    expect(carolFirst.kind).toBe('removed');
    expect(carolThen.kind).toBe('removed');
    expect(alice.group.epoch).toBe(bob.group.epoch);
    // The winning commit was only an update, so carol is still in the group.
    expect(alice.group.identities()).toContain(idOf('carol'));
    const sealed = await alice.group.encrypt(text.encode('converged'));
    expect(read(await bob.group.decrypt(sealed))).toBe('converged');
  });

  it('lets a removed member rejoin with a fresh key package and read only what follows', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const old = await alice.group.encrypt(text.encode('old history'));
    const removal = (await alice.group.removeIdentities([idOf('carol')]))!;
    const removalId = nextId();
    alice.group.confirm(removalId);
    await bob.group.applyCommit({
      bytes: removal.commit,
      epoch: removal.epoch,
      id: removalId,
    });
    await carol.group.applyCommit({
      bytes: removal.commit,
      epoch: removal.epoch,
      id: removalId,
    });

    const returning = await device('carol', 'd2');
    const { groups } = await admit(alice.group, [returning], [bob.group]);
    const fresh = await alice.group.encrypt(text.encode('new history'));

    expect(read(await groups[0].decrypt(fresh))).toBe('new history');
    await expect(groups[0].decrypt(old)).rejects.toThrow();
  });

  it('does not let a new member read earlier messages', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const earlier = await alice.group.encrypt(text.encode('before dave'));
    const dave = await device('dave');

    const { groups } = await admit(alice.group, [dave], [bob.group]);

    await expect(groups[0].decrypt(earlier)).rejects.toThrow();
  });

  it('refuses to add a key package whose identity is not a community member', async () => {
    const { alice } = await setup(['alice', 'bob']);
    const outsider = await device('mallory');

    await expect(alice.group.add([outsider.publicBytes])).rejects.toThrow(
      'not a member',
    );
  });

  it('rejects a commit that adds an identity the receiver knows is not a member', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    members.add(idOf('mallory'));
    const outsider = await device('mallory');
    const output = await alice.group.add([outsider.publicBytes]);
    alice.group.confirm('c-mallory');
    members.delete(idOf('mallory'));

    await expect(
      bob.group.applyCommit({
        bytes: output.commit,
        epoch: output.epoch,
        id: 'c-mallory',
      }),
    ).rejects.toThrow('Commit rejected');
    expect(bob.group.identities()).not.toContain(idOf('mallory'));
  });

  it('refuses a key package whose credential names an identity that did not sign it', async () => {
    const { alice } = await setup(['alice', 'bob']);
    // Mallory's key, presenting a device as bob's.
    const forged = await generateMlsKeyPackage(
      new MlsLeafSigner(
        cast.bob.owner('d9'),
        cast.mallory.keyPair,
        cast.bob.deviceKeyPair('d9'),
      ),
    );

    expect(() => mlsKeyPackageOwner(forged.publicBytes)).toThrow('forged');
    await expect(alice.group.add([forged.publicBytes])).rejects.toThrow(
      'forged',
    );
    expect(alice.group.leaves()).toHaveLength(2);
  });

  it('refuses a leaf a revoked device presents as a current device of its identity', async () => {
    const { alice } = await setup(['alice', 'bob']);
    // Bob's identity key, kept by a revoked device, cannot sign as bob's d2.
    const forged = await generateMlsKeyPackage(
      new MlsLeafSigner(
        cast.bob.owner('d2'),
        cast.bob.keyPair,
        cast.bob.deviceKeyPair('d9'),
      ),
    );

    expect(() => mlsKeyPackageOwner(forged.publicBytes)).toThrow('forged');
    await expect(alice.group.add([forged.publicBytes])).rejects.toThrow(
      'forged',
    );
  });

  it('refuses to commit an add the roster does not let this member make', async () => {
    const { bob } = await setup(['alice', 'bob']);
    allows = aliceManages;
    const dave = await device('dave');

    await expect(bob.group.add([dave.publicBytes])).rejects.toThrow(
      'may not make this change',
    );
    expect(bob.group.identities()).not.toContain(idOf('dave'));
  });

  it('rejects a removal by a member the roster does not let remove', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    // Bob's client ignores the rule; alice and carol enforce it.
    const removal = (await bob.group.removeIdentities([idOf('carol')]))!;
    bob.group.confirm('c-bob');
    allows = aliceManages;
    const record = { bytes: removal.commit, epoch: removal.epoch, id: 'c-bob' };

    await expect(alice.group.applyCommit(record)).rejects.toThrow('rejected');
    await expect(carol.group.applyCommit(record)).rejects.toThrow('rejected');
    expect(alice.group.identities()).toContain(idOf('carol'));
    expect(carol.group.isRemoved).toBe(false);
  });

  it('still applies a leaf rotation by a member who may not change membership', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    allows = aliceManages;
    const update = await bob.group.update();
    bob.group.confirm('c-update');

    const outcome = await alice.group.applyCommit({
      bytes: update.commit,
      epoch: update.epoch,
      id: 'c-update',
    });

    expect(outcome.kind).toBe('applied');
  });

  it('survives serialization of the group state', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const restored = MlsGroup.restore(
      'community-1',
      bob.key.owner,
      policy,
      bob.group.serialize(),
      bob.group.frontier,
    );

    const sealed = await alice.group.encrypt(text.encode('after restart'));

    expect(read(await restored.decrypt(sealed))).toBe('after restart');
  });
});
