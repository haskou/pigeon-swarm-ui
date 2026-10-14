import type { PrivateKeyPackage } from 'ts-mls';

import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';
import type { MlsRecordResource } from '../../../../../contexts/communities/infrastructure/http/resources/MlsRecordResource';
import type { MlsRecordTransport } from '../../../../../contexts/communities/infrastructure/mls/MlsRecordTransport';
import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { StoredMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/StoredMlsKeyPackage';

import { deriveMlsRecordId } from '../../../../../contexts/communities/infrastructure/http/deriveMlsRecordId';
import { MlsCommunityEngine } from '../../../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';
import { generateMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/MlsGroup';
import { MlsLeafSigner } from '../../../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { MlsTestIdentity } from './MlsTestIdentity';

const COMMUNITY = 'community-1';

const visible = (
  record: MlsRecordResource,
  query: Parameters<MlsRecordTransport['list']>[0],
  viewer: string,
): boolean =>
  record.groupId === query.groupId &&
  (!query.kind || record.kind === query.kind) &&
  (query.afterEpoch === undefined || (record.epoch ?? -1) > query.afterEpoch) &&
  (record.kind !== 'welcome' ||
    [record.recipientIdentityId, record.authorIdentityId].includes(viewer));

const createNode = () => {
  const records: MlsRecordResource[] = [];

  return {
    records,
    transportFor: (identityId: string): MlsRecordTransport => ({
      list: (query) =>
        Promise.resolve(records.filter((r) => visible(r, query, identityId))),
      publish: (input: MlsRecordInput) => {
        const recordId = deriveMlsRecordId(input);
        const existing = records.find((r) => r.recordId === recordId);

        if (existing) return Promise.resolve(existing);
        const record: MlsRecordResource = {
          ...input,
          authorIdentityId: identityId,
          communityId: COMMUNITY,
          createdAt: records.length + 1,
          recordId,
        };

        records.push(record);

        return Promise.resolve(record);
      },
    }),
  };
};

const createStore = (): MlsStateStore & { plaintexts: Map<string, string> } => {
  const groups = new Map<string, Uint8Array>();
  const keyPackages = new Map<string, StoredMlsKeyPackage<PrivateKeyPackage>>();
  const plaintexts = new Map<string, string>();

  return {
    deleteKeyPackage: (id) => {
      keyPackages.delete(id);

      return Promise.resolve();
    },
    loadGroup: (groupId) => Promise.resolve(groups.get(groupId)),
    loadKeyPackages: () => Promise.resolve([...keyPackages.values()]),
    loadPlaintext: (groupId, id) =>
      Promise.resolve(plaintexts.get(`${groupId}/${id}`)),
    plaintexts,
    saveGroup: (groupId, state) => {
      groups.set(groupId, state);

      return Promise.resolve();
    },
    saveKeyPackage: (keyPackage) => {
      keyPackages.set(keyPackage.id, keyPackage);

      return Promise.resolve();
    },
    savePlaintext: (groupId, id, plaintext) => {
      plaintexts.set(`${groupId}/${id}`, plaintext);

      return Promise.resolve();
    },
  };
};

describe('MlsCommunityEngine', () => {
  const node = createNode();
  let cast: Record<string, MlsTestIdentity>;
  let roster: Set<string>;
  const id = (name: string): string => cast[name].id;
  const engineFor = (name: string, store = createStore()) => ({
    engine: new MlsCommunityEngine(
      cast[name].signer('device-1'),
      store,
      () => node.transportFor(id(name)),
      () => () => Promise.resolve(roster),
    ),
    store,
  });

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['alice', 'bob', 'carol', 'mallory']);
  });

  beforeEach(() => {
    node.records.length = 0;
    roster = new Set([id('alice'), id('bob'), id('carol')]);
  });

  const admitBob = async (): Promise<{
    alice: ReturnType<typeof engineFor>;
    bob: ReturnType<typeof engineFor>;
  }> => {
    const alice = engineFor('alice');
    const bob = engineFor('bob');

    await alice.engine.createGroup(COMMUNITY);
    await bob.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('bob')]);
    await bob.engine.sync(COMMUNITY);

    return { alice, bob };
  };

  it('lets an admitted member read what the group sends', async () => {
    const { alice, bob } = await admitBob();
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'hello bob');

    expect(ciphertext).not.toContain('hello');
    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'hello bob',
    );
  });

  it('decrypts the same ciphertext again and for its own sender', async () => {
    const { alice, bob } = await admitBob();
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'once');

    await bob.engine.decrypt(COMMUNITY, ciphertext);

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'once',
    );
    await expect(alice.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'once',
    );
  });

  it('resumes from device-local state after a restart', async () => {
    const { alice, bob } = await admitBob();
    const restarted = engineFor('bob', bob.store);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'after restart');

    await expect(restarted.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'after restart',
    );
  });

  it('locks a removed member out of everything sent afterwards', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await bob.engine.sync(COMMUNITY);
    await carol.engine.sync(COMMUNITY);

    roster.delete(id('bob'));
    await alice.engine.remove(COMMUNITY, [id('bob')]);
    await carol.engine.sync(COMMUNITY);
    const secret = await alice.engine.encrypt(COMMUNITY, 'bob must not read');

    await expect(carol.engine.decrypt(COMMUNITY, secret)).resolves.toBe(
      'bob must not read',
    );
    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(false);
    await expect(bob.engine.decrypt(COMMUNITY, secret)).rejects.toThrow();
  });

  it('follows the roster: admits joiners and removes those who left', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    roster.add(id('carol'));
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await carol.engine.sync(COMMUNITY);
    await alice.engine.sync(COMMUNITY);
    const first = await alice.engine.encrypt(COMMUNITY, 'hello carol');

    await expect(carol.engine.decrypt(COMMUNITY, first)).resolves.toBe(
      'hello carol',
    );

    roster.delete(id('bob'));
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(false);
    await expect(alice.engine.identities(COMMUNITY)).resolves.not.toContain(
      id('bob'),
    );
  });

  it('admits a member who joined the roster after the group was created', async () => {
    roster = new Set([id('alice')]);
    const alice = engineFor('alice');
    const bob = engineFor('bob');

    await alice.engine.createGroup(COMMUNITY);
    roster = new Set([id('alice'), id('bob')]);
    await bob.engine.publishKeyPackages(COMMUNITY);
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await bob.engine.sync(COMMUNITY);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'late joiner');

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'late joiner',
    );
  });

  it('gives a joiner a welcome only the recipient can use', async () => {
    const { alice } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    const welcomeSeenByBob = await node
      .transportFor(id('bob'))
      .list({ groupId: COMMUNITY, kind: 'welcome' });

    expect(
      welcomeSeenByBob.every((r) => r.recipientIdentityId === id('bob')),
    ).toBe(true);
  });

  it('does not admit someone who is not on the roster', async () => {
    const alice = engineFor('alice');
    const mallory = engineFor('mallory');

    await alice.engine.createGroup(COMMUNITY);
    await mallory.engine.publishKeyPackages(COMMUNITY);

    await expect(
      alice.engine.admit(COMMUNITY, [id('mallory')]),
    ).rejects.toThrow();
  });

  it('ignores a key package whose credential the named identity did not sign', async () => {
    const alice = engineFor('alice');
    const bob = engineFor('bob');
    // Published under bob's name, but its credential is signed by mallory.
    const forged = await generateMlsKeyPackage(
      new MlsLeafSigner(
        { deviceId: 'device-9', identityId: id('bob') },
        cast.mallory.keyPair,
      ),
    );

    await alice.engine.createGroup(COMMUNITY);
    await bob.engine.publishKeyPackages(COMMUNITY);
    await node.transportFor(id('bob')).publish({
      groupId: COMMUNITY,
      kind: 'key_package',
      payload: Buffer.from(forged.publicBytes).toString('base64'),
    });
    await alice.engine.admit(COMMUNITY, [id('bob')]);
    await bob.engine.sync(COMMUNITY);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'genuine only');

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'genuine only',
    );
    await expect(alice.engine.identities(COMMUNITY)).resolves.toEqual(
      expect.arrayContaining([id('alice'), id('bob')]),
    );
  });
});
