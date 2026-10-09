import type { PrivateKeyPackage } from 'ts-mls';

import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';
import type { MlsRecordResource } from '../../../../../contexts/communities/infrastructure/http/resources/MlsRecordResource';
import type { MlsRecordTransport } from '../../../../../contexts/communities/infrastructure/mls/MlsRecordTransport';
import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { StoredMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/StoredMlsKeyPackage';

import { deriveMlsRecordId } from '../../../../../contexts/communities/infrastructure/http/deriveMlsRecordId';
import { MlsCommunityEngine } from '../../../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';

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
  let roster: Set<string>;
  const engineFor = (identityId: string, store = createStore()) => ({
    engine: new MlsCommunityEngine(
      { deviceId: 'device-1', identityId },
      store,
      () => node.transportFor(identityId),
      () => () => Promise.resolve(roster),
    ),
    store,
  });

  beforeEach(() => {
    node.records.length = 0;
    roster = new Set(['alice', 'bob', 'carol']);
  });

  const admitBob = async (): Promise<{
    alice: ReturnType<typeof engineFor>;
    bob: ReturnType<typeof engineFor>;
  }> => {
    const alice = engineFor('alice');
    const bob = engineFor('bob');

    await alice.engine.createGroup(COMMUNITY);
    await bob.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, ['bob']);
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
    await alice.engine.admit(COMMUNITY, ['carol']);
    await bob.engine.sync(COMMUNITY);
    await carol.engine.sync(COMMUNITY);

    roster.delete('bob');
    await alice.engine.remove(COMMUNITY, ['bob']);
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
    roster.add('carol');
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await carol.engine.sync(COMMUNITY);
    await alice.engine.sync(COMMUNITY);
    const first = await alice.engine.encrypt(COMMUNITY, 'hello carol');

    await expect(carol.engine.decrypt(COMMUNITY, first)).resolves.toBe(
      'hello carol',
    );

    roster.delete('bob');
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(false);
    await expect(alice.engine.identities(COMMUNITY)).resolves.not.toContain(
      'bob',
    );
  });

  it('gives a joiner a welcome only the recipient can use', async () => {
    const { alice } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, ['carol']);
    const welcomeSeenByBob = await node
      .transportFor('bob')
      .list({ groupId: COMMUNITY, kind: 'welcome' });

    expect(welcomeSeenByBob.every((r) => r.recipientIdentityId === 'bob')).toBe(
      true,
    );
  });

  it('does not admit someone who is not on the roster', async () => {
    const alice = engineFor('alice');
    const mallory = engineFor('mallory');

    await alice.engine.createGroup(COMMUNITY);
    await mallory.engine.publishKeyPackages(COMMUNITY);

    await expect(alice.engine.admit(COMMUNITY, ['mallory'])).rejects.toThrow();
  });
});
