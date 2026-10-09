import {
  MlsGroup,
  type MlsCommitOutput,
  type MlsKeyPackageBundle,
  generateMlsKeyPackage,
} from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';

const text = new TextEncoder();
const read = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const members = new Set(['alice', 'bob', 'carol', 'dave']);
const policy = (identityId: string): boolean => members.has(identityId);

const device = (identityId: string, deviceId = 'd1') =>
  generateMlsKeyPackage({ deviceId, identityId });

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
  it('delivers a message to every member of a multi-user group', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);

    const sealed = await alice.group.encrypt(text.encode('hello everyone'));

    expect(read(await bob.group.decrypt(sealed))).toBe('hello everyone');
    expect(read(await carol.group.decrypt(sealed))).toBe('hello everyone');
    expect(alice.group.identities().sort()).toEqual(['alice', 'bob', 'carol']);
  });

  it('lets a second device of the same identity join and read', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = await device('bob', 'phone');

    const { groups } = await admit(alice.group, [phone], [bob.group]);
    const sealed = await alice.group.encrypt(text.encode('to both devices'));

    expect(read(await groups[0].decrypt(sealed))).toBe('to both devices');
    expect(read(await bob.group.decrypt(sealed))).toBe('to both devices');
    expect(alice.group.identities().sort()).toEqual(['alice', 'bob']);
    expect(alice.group.leaves()).toHaveLength(3);
  });

  it('stops a removed member from decrypting what is sent afterwards', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const before = await alice.group.encrypt(text.encode('before'));
    expect(read(await carol.group.decrypt(before))).toBe('before');

    const removal = (await alice.group.removeIdentities(['carol']))!;
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
    expect(alice.group.identities()).not.toContain('carol');
  });

  it('removes every device of an identity at once', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const phone = await device('bob', 'phone');
    const { groups } = await admit(alice.group, [phone], [bob.group]);

    const removal = (await alice.group.removeIdentities(['bob']))!;
    const id = nextId();
    alice.group.confirm(id);
    const record = { bytes: removal.commit, epoch: removal.epoch, id };

    expect((await bob.group.applyCommit(record)).kind).toBe('removed');
    expect((await groups[0].applyCommit(record)).kind).toBe('removed');
    expect(alice.group.leaves()).toHaveLength(1);
  });

  it('does not give a member of one group the secret of another group', async () => {
    const community = await setup(['alice', 'bob', 'carol']);
    const aliceChannelKey = await device('alice', 'channel');
    const channel = await MlsGroup.create(
      'community-1:private',
      aliceChannelKey,
      policy,
    );
    const bobChannelKey = await device('bob', 'channel');
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
    const fromAlice = (await alice.group.removeIdentities(['carol']))!;
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
    expect(alice.group.identities()).toContain('carol');
    const sealed = await alice.group.encrypt(text.encode('converged'));
    expect(read(await bob.group.decrypt(sealed))).toBe('converged');
  });

  it('lets a removed member rejoin with a fresh key package and read only what follows', async () => {
    const { alice, bob, carol } = await setup(['alice', 'bob', 'carol']);
    const old = await alice.group.encrypt(text.encode('old history'));
    const removal = (await alice.group.removeIdentities(['carol']))!;
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
    members.add('mallory');
    const outsider = await device('mallory');
    const output = await alice.group.add([outsider.publicBytes]);
    alice.group.confirm('c-mallory');
    members.delete('mallory');

    await expect(
      bob.group.applyCommit({
        bytes: output.commit,
        epoch: output.epoch,
        id: 'c-mallory',
      }),
    ).rejects.toThrow('validate credential');
    expect(bob.group.identities()).not.toContain('mallory');
  });

  it('survives serialization of the group state', async () => {
    const { alice, bob } = await setup(['alice', 'bob']);
    const restored = MlsGroup.restore(
      'community-1',
      bob.key.owner,
      policy,
      bob.group.serialize(),
    );

    const sealed = await alice.group.encrypt(text.encode('after restart'));

    expect(read(await restored.decrypt(sealed))).toBe('after restart');
  });
});
