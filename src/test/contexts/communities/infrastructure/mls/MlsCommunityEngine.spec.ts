import { CommitmentId, KeyPair } from '@haskou/pigeon-swarm-crypto';
import {
  MlsGroup,
  MlsKeyPackage,
  MlsLeafSigner,
} from '@haskou/pigeon-swarm-crypto/mls';

import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';
import type { MlsRecordResource } from '../../../../../contexts/communities/infrastructure/http/resources/MlsRecordResource';
import type { MlsRecordTransport } from '../../../../../contexts/communities/infrastructure/mls/MlsRecordTransport';
import type { MlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/MlsStateStore';
import type { StoredMlsKeyPackage } from '../../../../../contexts/communities/infrastructure/mls/StoredMlsKeyPackage';

import { CommunityRosterHistory } from '../../../../../contexts/communities/domain/CommunityRosterHistory';
import { MlsUpdateCadence } from '../../../../../contexts/communities/domain/MlsUpdateCadence';
import { CommunityOperationProof } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationProof';
import { MlsCommunityEngine } from '../../../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';
import { CommunityOperationHistory } from '../http/CommunityOperationHistory';
import { MlsTestIdentity } from './MlsTestIdentity';

const COMMUNITY = 'community-1';
/** Lets a member build commits the community rules forbid. */
const anything = {
  admits: () => true,
  allows: () => true,
  frontier: (): string[] => [],
  priority: () => 0,
  reach: () => 0,
  withheld: () => false,
};
const base64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');

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

/**
 * An in-memory node. `beforePublish` and `afterPublish` may throw to stand
 * for a node that is unreachable, or a device that stopped once a record
 * had been stored.
 */
const createNode = () => {
  const records: MlsRecordResource[] = [];
  const hooks: {
    afterPublish?: (record: MlsRecordResource) => void;
    beforePublish?: (input: MlsRecordInput) => void;
  } = {};

  return {
    hooks,
    records,
    transportFor: (identityId: string): MlsRecordTransport => ({
      list: (query) =>
        Promise.resolve(records.filter((r) => visible(r, query, identityId))),
      publish: (input: MlsRecordInput) => {
        try {
          hooks.beforePublish?.(input);
        } catch (error) {
          return Promise.reject(error);
        }
        const recordId = CommitmentId.mlsRecord(input);
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
        hooks.afterPublish?.(record);

        return Promise.resolve(record);
      },
    }),
  };
};

const createStore = (): MlsStateStore & { plaintexts: Map<string, string> } => {
  const groups = new Map<string, Uint8Array>();
  const keyPackages = new Map<string, StoredMlsKeyPackage>();
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
  let moderators: Set<string>;
  /** What a node or a member adds to the honest history, per spec. */
  let tamper: (history: CommunityOperationHistory, managers: string) => void;
  /** A key that is no member's identity key, as a node's would be. */
  let nodeKey: KeyPair;
  /** The time on every device's clock. */
  let now: number;
  /** What every device draws its update jitter from. */
  let jitter: number;
  /** The history so far, and the roster, moderators and tamper it holds. */
  let signed:
    | {
        applied: typeof tamper;
        history: CommunityOperationHistory;
        managers: string;
        members: Set<string>;
        moderating: Set<string>;
      }
    | undefined;
  const id = (name: string): string => cast[name].id;
  const startHistory = (): NonNullable<typeof signed> => {
    const history = new CommunityOperationHistory(cast.alice);
    const managers = history.createRole(cast.alice, ['manage_members']);

    return {
      applied: () => undefined,
      history,
      managers,
      members: new Set([id('alice')]),
      moderating: new Set(),
    };
  };
  /** Appends the operations that bring the history up to `roster`. */
  const followRoster = (state: NonNullable<typeof signed>): void => {
    for (const member of Object.values(cast)) {
      const wanted = roster.has(member.id);

      if (wanted !== state.members.has(member.id)) {
        if (wanted) {
          state.history.add(cast.alice, member);
          state.members.add(member.id);
        } else {
          state.history.kick(cast.alice, member);
          state.members.delete(member.id);
        }
      }
    }
  };
  /** Appends the role changes that bring the history up to `moderators`. */
  const followModerators = (state: NonNullable<typeof signed>): void => {
    for (const member of Object.values(cast)) {
      const wanted = moderators.has(member.id);

      if (wanted !== state.moderating.has(member.id)) {
        state.history.assign(
          cast.alice,
          member,
          wanted ? [state.managers] : [],
        );

        if (wanted) state.moderating.add(member.id);
        else state.moderating.delete(member.id);
      }
    }
  };
  /**
   * The community's signed history: the owner alice creates it and a role
   * that may add members, then adds and kicks whoever joins or leaves the
   * roster and gives or takes the role as moderators change. It only ever
   * grows, as a real community's does.
   */
  const historyOf = (): CommunityOperationHistory => {
    const state = signed ?? startHistory();

    signed = state;
    followRoster(state);
    followModerators(state);

    if (state.applied !== tamper) {
      tamper(state.history, state.managers);
      state.applied = tamper;
    }

    return state.history;
  };
  const engineFor = (name: string, store = createStore(), device = 'd1') => ({
    engine: new MlsCommunityEngine(
      cast[name].signer(device),
      store,
      () => node.transportFor(id(name)),
      (groupId) => () =>
        Promise.resolve(
          CommunityRosterHistory.of(
            historyOf().operations(),
            groupId.split(':')[1],
          ),
        ),
      () => now,
      () => jitter,
    ),
    store,
  });
  /** The member's group, under rules that let it commit anything. */
  const rogueGroupOf = async (
    name: string,
    store: MlsStateStore,
    frontier = CommunityRosterHistory.of(historyOf().operations()).heads(),
  ): Promise<MlsGroup> =>
    MlsGroup.restore(
      COMMUNITY,
      cast[name].signer().owner,
      { ...anything, frontier: () => frontier },
      (await store.loadGroup(COMMUNITY)) as Uint8Array,
      frontier,
    );
  const keyPackageOf = (name: string): Uint8Array =>
    Buffer.from(
      node.records.find(
        (record) =>
          record.kind === 'key_package' && record.authorIdentityId === id(name),
      )?.payload as string,
      'base64',
    );
  const publishCommit = async (
    name: string,
    output: { commit: Uint8Array; epoch: bigint },
  ): Promise<void> => {
    await node.transportFor(id(name)).publish({
      epoch: Number(output.epoch),
      groupId: COMMUNITY,
      kind: 'commit',
      payload: base64(output.commit),
    });
  };
  const publishWelcome = async (
    name: string,
    output: { epoch: bigint; welcome?: Uint8Array },
    recipient: string,
  ): Promise<void> => {
    await node.transportFor(id(name)).publish({
      epoch: Number(output.epoch),
      groupId: COMMUNITY,
      kind: 'welcome',
      payload: base64(output.welcome as Uint8Array),
      recipientIdentityId: id(recipient),
    });
  };

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['alice', 'bob', 'carol', 'mallory']);
    nodeKey = await KeyPair.generate();
  });

  beforeEach(() => {
    node.records.length = 0;
    delete node.hooks.afterPublish;
    delete node.hooks.beforePublish;
    roster = new Set([id('alice'), id('bob'), id('carol')]);
    moderators = new Set();
    tamper = () => undefined;
    signed = undefined;
    now = 1_700_000_000_000;
    jitter = 0;
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

  /** Alice, bob and carol share the group in the same epoch. */
  const admitCarol = async (): Promise<{
    alice: ReturnType<typeof engineFor>;
    bob: ReturnType<typeof engineFor>;
    carol: ReturnType<typeof engineFor>;
  }> => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await bob.engine.sync(COMMUNITY);
    await carol.engine.sync(COMMUNITY);

    return { alice, bob, carol };
  };
  const secretOf = (member: ReturnType<typeof engineFor>) =>
    member.engine.callMediaKey(COMMUNITY, 'epoch');
  const failCommits = (error: Error): void => {
    node.hooks.beforePublish = (input) => {
      if (input.kind === 'commit') throw error;
    };
  };
  /** The node stores the next commit, but its answer never arrives. */
  const loseCommitAnswer = (): void => {
    node.hooks.afterPublish = (record) => {
      if (record.kind !== 'commit') return;
      delete node.hooks.afterPublish;
      throw new Error('answer lost');
    };
  };
  const commitsAt = (epoch: number): MlsRecordResource[] =>
    node.records.filter(
      (record) => record.kind === 'commit' && record.epoch === epoch,
    );
  /** The bytes kept under the member's pending commit; 0 when there is none. */
  const pendingIn = async (store: MlsStateStore): Promise<number> =>
    (await store.loadGroup(`${COMMUNITY}#pending`))?.length ?? 0;
  /** Makes the member stop when it is about to forget its pending commit. */
  const stopBeforeForgettingPending = (store: MlsStateStore): void => {
    const saveGroup = store.saveGroup.bind(store);

    jest
      .spyOn(store, 'saveGroup')
      .mockImplementation((key, state) =>
        key === `${COMMUNITY}#pending` && state.length === 0
          ? Promise.reject(new Error('crash'))
          : saveGroup(key, state),
      );
  };
  /** Collects every welcome published to the identity from now on. */
  const welcomesTo = (name: string): string[] => {
    const sent: string[] = [];

    node.hooks.beforePublish = (input) => {
      if (input.kind === 'welcome' && input.recipientIdentityId === id(name)) {
        sent.push(input.payload);
      }
    };

    return sent;
  };
  const failWelcomes = (): void => {
    node.hooks.beforePublish = (input) => {
      if (input.kind === 'welcome') throw new Error('crash');
    };
  };
  /**
   * Alice creates a channel and restricts it to a role the viewers hold;
   * returns the MLS group id of the channel.
   */
  const restrictChannel = (viewers: string[]): string => {
    let groupId = '';

    tamper = (history) => {
      const role = history.createRole(cast.alice, []);
      const channelId = history.createChannel(cast.alice);

      for (const viewer of viewers) {
        history.assign(cast.alice, cast[viewer], [role]);
      }

      history.restrictChannel(cast.alice, channelId, [role]);
      groupId = `${COMMUNITY}:${channelId}`;
    };
    historyOf();

    return groupId;
  };
  /** Alice starts the channel's group and admits who may see it. */
  const openChannel = async (groupId: string) => {
    const members = {
      alice: engineFor('alice'),
      bob: engineFor('bob'),
      carol: engineFor('carol'),
    };

    await members.alice.engine.createGroup(groupId);
    await members.bob.engine.publishKeyPackages(groupId);
    await members.carol.engine.publishKeyPackages(groupId);
    await members.alice.engine.reconcile(groupId);
    await members.bob.engine.sync(groupId);
    await members.carol.engine.sync(groupId);

    return members;
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

  it('keeps what it read in its store after the message key is gone', async () => {
    const { alice, bob } = await admitBob();
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'kept at rest');
    await bob.engine.decrypt(COMMUNITY, ciphertext);

    // The stored group no longer holds the key; the stored plaintext does.
    const restarted = engineFor('bob', bob.store);

    await expect(restarted.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'kept at rest',
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

  it('lets a removed member back in only with a newer welcome', async () => {
    const { alice, bob } = await admitBob();

    roster.delete(id('bob'));
    await alice.engine.remove(COMMUNITY, [id('bob')]);
    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(false);

    roster.add(id('bob'));
    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(false);
    await bob.engine.publishKeyPackages(COMMUNITY);
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'welcome back');

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'welcome back',
    );
  });

  it('follows the roster: managers admit joiners, anyone removes those who left', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await carol.engine.sync(COMMUNITY);
    await bob.engine.sync(COMMUNITY);
    const first = await alice.engine.encrypt(COMMUNITY, 'hello carol');

    await expect(carol.engine.decrypt(COMMUNITY, first)).resolves.toBe(
      'hello carol',
    );

    roster.delete(id('carol'));
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await expect(carol.engine.reconcile(COMMUNITY)).resolves.toBe(false);
    await alice.engine.sync(COMMUNITY);
    await expect(alice.engine.identities(COMMUNITY)).resolves.not.toContain(
      id('carol'),
    );
  });

  it('leaves admission to the owner and members whose role may kick', async () => {
    const { bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await carol.engine.sync(COMMUNITY);
    await expect(carol.engine.hasGroup(COMMUNITY)).resolves.toBe(false);

    moderators.add(id('bob'));
    await expect(bob.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await carol.engine.sync(COMMUNITY);
    const ciphertext = await bob.engine.encrypt(COMMUNITY, 'from a moderator');

    await expect(carol.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'from a moderator',
    );
  });

  it('admits every device of a member, not only the first', async () => {
    const { alice } = await admitBob();
    const laptop = engineFor('bob', createStore(), 'd2');

    await laptop.engine.publishKeyPackages(COMMUNITY);
    await expect(alice.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await laptop.engine.sync(COMMUNITY);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'both devices');

    await expect(laptop.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'both devices',
    );
    expect(
      (await alice.engine.credentials(COMMUNITY))?.leaves
        .filter(({ owner }) => owner.identityId === id('bob'))
        .map(({ owner }) => owner.deviceCredential)
        .sort(),
    ).toEqual(
      [cast.bob.deviceCredential('d1'), cast.bob.deviceCredential('d2')].sort(),
    );
  });

  it('rejects an add from a member who may not add, and its welcome', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');
    const mallory = engineFor('mallory');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await carol.engine.sync(COMMUNITY);
    await bob.engine.sync(COMMUNITY);
    roster.add(id('mallory'));
    await mallory.engine.publishKeyPackages(COMMUNITY);
    const forged = await (
      await rogueGroupOf('carol', carol.store)
    ).add([keyPackageOf('mallory')]);

    await publishCommit('carol', forged);
    await publishWelcome('carol', forged, 'mallory');

    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(false);
    await expect(bob.engine.identities(COMMUNITY)).resolves.not.toContain(
      id('mallory'),
    );

    // The owner's own commit for the same epoch still goes through.
    await alice.engine.sync(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('mallory')]);
    await bob.engine.sync(COMMUNITY);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'still ours');

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'still ours',
    );
  });

  describe('trusts only the signed role history', () => {
    /** Carol adds mallory to the group, which only a manager may do. */
    const carolAddsMallory = async () => {
      const { alice, bob } = await admitBob();
      const carol = engineFor('carol');
      const mallory = engineFor('mallory');

      await carol.engine.publishKeyPackages(COMMUNITY);
      await alice.engine.admit(COMMUNITY, [id('carol')]);
      await carol.engine.sync(COMMUNITY);
      await bob.engine.sync(COMMUNITY);
      roster.add(id('mallory'));
      await mallory.engine.publishKeyPackages(COMMUNITY);
      const added = await (
        await rogueGroupOf('carol', carol.store)
      ).add([keyPackageOf('mallory')]);

      await publishCommit('carol', added);
      await publishWelcome('carol', added, 'mallory');
      await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);

      return {
        committed: (await bob.engine.identities(COMMUNITY)).includes(
          id('mallory'),
        ),
        welcomed: await mallory.engine.hasGroup(COMMUNITY),
      };
    };

    it('accepts the add and its welcome when the owner made carol a manager', async () => {
      tamper = (history, managers) =>
        history.assign(cast.alice, cast.carol, [managers]);

      await expect(carolAddsMallory()).resolves.toEqual({
        committed: true,
        welcomed: true,
      });
    });

    it('rejects the add and its welcome when the node forges a role assignment', async () => {
      tamper = (history, managers) =>
        history.append(
          cast.alice,
          'member_roles_updated',
          { identityId: id('carol'), roleIds: [managers] },
          nodeKey,
        );

      await expect(carolAddsMallory()).resolves.toEqual({
        committed: false,
        welcomed: false,
      });
    });

    it('rejects the add and its welcome when the node adds manage_members to a role', async () => {
      tamper = (history) => {
        const helpers = history.createRole(cast.alice, ['send_messages']);

        history.assign(cast.alice, cast.carol, [helpers]);
        const honest = history.append(cast.alice, 'role_updated', {
          name: 'Role',
          permissions: ['send_messages'],
          roleId: helpers,
        });
        const content = CommunityOperationProof.contentOf(honest);
        const altered = CommunityOperationProof.seal(
          {
            ...content,
            args: {
              ...content.args,
              permissions: ['send_messages', 'manage_members'],
            },
          },
          nodeKey,
        );

        // Re-addressed to its new content, still under alice's signature.
        history.documents.splice(-1, 1, {
          ...altered,
          identitySignature: honest.identitySignature,
        });
      };

      await expect(carolAddsMallory()).resolves.toEqual({
        committed: false,
        welcomed: false,
      });
    });

    it('rejects the add and its welcome when a member without manage_roles grants the role', async () => {
      tamper = (history, managers) => {
        const granted = history.createRole(cast.bob, ['manage_members']);

        history.assign(cast.bob, cast.carol, [granted, managers]);
      };

      await expect(carolAddsMallory()).resolves.toEqual({
        committed: false,
        welcomed: false,
      });
    });
  });

  describe('judges a commit by the roster revision it binds', () => {
    /** The head of the signed history as it stands now. */
    const headsNow = (): string[] => {
      const { documents } = historyOf();

      return [
        CommunityOperationHistory.digestOf(documents[documents.length - 1]),
      ];
    };
    /** Alice, bob and carol share the group; carol may add members. */
    const carolManages = async () => {
      moderators.add(id('carol'));
      roster.add(id('mallory'));

      return { ...(await admitCarol()), mallory: engineFor('mallory') };
    };
    const demoteCarol = (): void => {
      tamper = (history) => history.assign(cast.alice, cast.carol, []);
    };
    /**
     * The member's engine behind a node that withholds one operation of the
     * signed history, and everything built on it, from it.
     */
    const withholding = (
      name: string,
      store: MlsStateStore,
      withheld: string,
      transport = node.transportFor(id(name)),
    ): MlsCommunityEngine =>
      new MlsCommunityEngine(
        cast[name].signer(),
        store,
        () => transport,
        (groupId) => () =>
          Promise.resolve(
            CommunityRosterHistory.of(
              historyOf()
                .operations()
                .filter((operation) => operation.getHash() !== withheld),
              groupId.split(':')[1],
            ),
          ),
        () => now,
        () => jitter,
      );

    it('accepts an add made before the demotion by a member who saw the demotion first', async () => {
      const { alice, bob, carol, mallory } = await carolManages();

      await mallory.engine.publishKeyPackages(COMMUNITY);
      await carol.engine.admit(COMMUNITY, [id('mallory')]);
      demoteCarol();

      await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(alice.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(bob.engine.identities(COMMUNITY)).resolves.toContain(
        id('mallory'),
      );
      const ciphertext = await bob.engine.encrypt(COMMUNITY, 'same epoch');

      await expect(alice.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'same epoch',
      );
      await expect(carol.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'same epoch',
      );
      // Nobody the joiner sees as a manager has committed on top of the add.
      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(false);
    });

    it('lets a joiner who sees its welcomer demoted in once a manager commits on top of the add', async () => {
      const { alice, carol, mallory } = await carolManages();

      await mallory.engine.publishKeyPackages(COMMUNITY);
      await carol.engine.admit(COMMUNITY, [id('mallory')]);
      demoteCarol();
      // The owner takes the add, then binds the demotion on top of it.
      await alice.engine.reconcile(COMMUNITY);

      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(true);
      const ciphertext = await alice.engine.encrypt(COMMUNITY, 'welcome');

      await expect(mallory.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'welcome',
      );
    });

    it('lets a joiner whose welcomer was kicked in once a manager commits after another member bound the kick', async () => {
      const { alice, bob, carol, mallory } = await carolManages();

      await mallory.engine.publishKeyPackages(COMMUNITY);
      await carol.engine.admit(COMMUNITY, [id('mallory')]);
      roster.delete(id('carol'));
      // Bob takes the add and removes the kicked carol, binding the kick.
      await bob.engine.reconcile(COMMUNITY);
      await alice.engine.reconcile(COMMUNITY);

      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(true);
      const ciphertext = await alice.engine.encrypt(COMMUNITY, 'welcome');

      await expect(mallory.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'welcome',
      );
    });

    it('rejects an add a demoted member makes after the demotion', async () => {
      const { bob, carol, mallory } = await carolManages();

      await mallory.engine.publishKeyPackages(COMMUNITY);
      demoteCarol();
      const added = await (
        await rogueGroupOf('carol', carol.store, headsNow())
      ).add([keyPackageOf('mallory')]);

      await publishCommit('carol', added);

      await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(bob.engine.identities(COMMUNITY)).resolves.not.toContain(
        id('mallory'),
      );
    });

    it('rejects an add a demoted member backdates to before the demotion', async () => {
      const { alice, bob, carol, mallory } = await carolManages();
      const beforeDemotion = headsNow();

      demoteCarol();
      // The owner binds the demotion into the group as soon as she sees it.
      await alice.engine.reconcile(COMMUNITY);
      await bob.engine.sync(COMMUNITY);
      await carol.engine.sync(COMMUNITY);
      await mallory.engine.publishKeyPackages(COMMUNITY);
      const backdated = await (
        await rogueGroupOf('carol', carol.store, beforeDemotion)
      ).add([keyPackageOf('mallory')]);

      await publishCommit('carol', backdated);

      await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(bob.engine.identities(COMMUNITY)).resolves.not.toContain(
        id('mallory'),
      );
      const ciphertext = await alice.engine.encrypt(COMMUNITY, 'still ours');

      await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'still ours',
      );
    });

    it('stops trusting a demoted manager once a manager commit binds a demotion the node withholds', async () => {
      const { alice, bob, carol, mallory } = await carolManages();
      const beforeDemotion = headsNow();

      demoteCarol();
      const withheld = withholding('bob', bob.store, headsNow()[0]);

      // The owner binds the demotion into the group as soon as she sees it.
      await alice.engine.reconcile(COMMUNITY);
      await mallory.engine.publishKeyPackages(COMMUNITY);
      await publishCommit(
        'carol',
        await (
          await rogueGroupOf('carol', carol.store, beforeDemotion)
        ).add([keyPackageOf('mallory')]),
      );

      await expect(withheld.reconcile(COMMUNITY)).resolves.toBe(true);
      await expect(withheld.identities(COMMUNITY)).resolves.not.toContain(
        id('mallory'),
      );
      // Once the node serves the demotion, bob follows the owner.
      await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
      const ciphertext = await alice.engine.encrypt(COMMUNITY, 'still ours');

      await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'still ours',
      );
      await expect(bob.engine.identities(COMMUNITY)).resolves.not.toContain(
        id('mallory'),
      );
    });

    it('steps back from a demoted manager add once a manager commit binds a demotion the node withholds', async () => {
      const { alice, bob, carol, mallory } = await carolManages();
      const beforeDemotion = headsNow();

      demoteCarol();
      const withheld = withholding('bob', bob.store, headsNow()[0]);

      await alice.engine.reconcile(COMMUNITY);
      // The node serves carol's add before the owner's commit.
      const binding = node.records.pop() as MlsRecordResource;

      await mallory.engine.publishKeyPackages(COMMUNITY);
      await publishCommit(
        'carol',
        await (
          await rogueGroupOf('carol', carol.store, beforeDemotion)
        ).add([keyPackageOf('mallory')]),
      );
      await expect(withheld.sync(COMMUNITY)).resolves.toBe(true);
      await expect(withheld.identities(COMMUNITY)).resolves.toContain(
        id('mallory'),
      );
      node.records.push(binding);

      await expect(withheld.sync(COMMUNITY)).resolves.toBe(true);
      await expect(withheld.identities(COMMUNITY)).resolves.not.toContain(
        id('mallory'),
      );
    });

    it('steps back no further than the epochs it lists when the node serves an older witness', async () => {
      const { alice, bob, carol } = await carolManages();
      const beforeDemotion = headsNow();
      const honest = node.transportFor(id('bob'));

      demoteCarol();
      // The node lists every commit, however old, and withholds the demotion.
      const withheld = withholding('bob', bob.store, headsNow()[0], {
        ...honest,
        list: (query) => honest.list({ ...query, afterEpoch: undefined }),
      });

      await alice.engine.reconcile(COMMUNITY);
      const binding = node.records.pop() as MlsRecordResource;
      const malloryKey = await MlsKeyPackage.generate(cast.mallory.signer());
      const added = await (
        await rogueGroupOf('carol', carol.store, beforeDemotion)
      ).add([malloryKey.publicBytes]);

      await publishCommit('carol', added);
      await withheld.sync(COMMUNITY);
      // Mallory rotates her leaf, and bob moves one more epoch on.
      const mallory = await MlsGroup.join(
        COMMUNITY,
        malloryKey,
        added.welcome as Uint8Array,
        { ...anything, frontier: () => beforeDemotion },
      );

      await publishCommit('mallory', await mallory.update());
      mallory.confirm('rotated');
      await withheld.sync(COMMUNITY);
      node.records.push(binding);

      await expect(withheld.sync(COMMUNITY)).resolves.toBe(true);
      const ciphertext = await mallory.encrypt(
        new TextEncoder().encode('moved on'),
      );

      await expect(
        withheld.decrypt(COMMUNITY, base64(ciphertext)),
      ).resolves.toBe('moved on');
    });

    /**
     * Alice kicks carol, who never sees it: she races the commit removing
     * her with an update for its epoch that wins on id, bound to the
     * revision `bind` picks from the one before the kick. Bob had applied
     * the removal; mallory sees both commits at once.
     */
    const raceRemoval = async (
      bind: (beforeKick: string[]) => string[],
    ): Promise<void> => {
      const { alice, bob, carol } = await admitCarol();
      const mallory = engineFor('mallory');

      roster.add(id('mallory'));
      await mallory.engine.publishKeyPackages(COMMUNITY);
      await alice.engine.reconcile(COMMUNITY);
      await Promise.all(
        [bob, carol, mallory].map(({ engine }) => engine.sync(COMMUNITY)),
      );
      const beforeKick = headsNow();

      roster.delete(id('carol'));
      await alice.engine.reconcile(COMMUNITY);
      const removal = node.records[node.records.length - 1];

      await bob.engine.sync(COMMUNITY);
      const frontier = bind(beforeKick);
      let raced = await (
        await rogueGroupOf('carol', carol.store, frontier)
      ).update();

      for (
        let attempt = 0;
        attempt < 64 &&
        CommitmentId.mlsRecord({
          epoch: Number(raced.epoch),
          groupId: COMMUNITY,
          kind: 'commit',
          payload: base64(raced.commit),
        }) >= removal.recordId;
        attempt += 1
      ) {
        raced = await (
          await rogueGroupOf('carol', carol.store, frontier)
        ).update();
      }
      await publishCommit('carol', raced);

      for (const member of [bob, mallory]) {
        await expect(member.engine.sync(COMMUNITY)).resolves.toBe(true);
        await expect(
          member.engine.identities(COMMUNITY),
        ).resolves.not.toContain(id('carol'));
      }
      const ciphertext = await alice.engine.encrypt(COMMUNITY, 'without carol');

      await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'without carol',
      );
      await expect(mallory.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
        'without carol',
      );
    };

    it('keeps a kicked member out when it races its removal with a backdated commit', async () => {
      await raceRemoval((beforeKick) => beforeKick);
    });

    it('keeps a kicked member out when it outreaches its removal with a concurrent branch', async () => {
      await raceRemoval((beforeKick) => {
        const history = historyOf();

        return [
          history.branch(cast.alice, [history.branch(cast.alice, beforeKick)]),
        ];
      });
    });

    it('refuses a welcome into a look-alike group from a demoted member', async () => {
      moderators.add(id('carol'));
      roster.add(id('mallory'));
      const alice = engineFor('alice');
      const mallory = engineFor('mallory');
      const beforeDemotion = headsNow();
      const lookAlike = await MlsGroup.create(
        COMMUNITY,
        await MlsKeyPackage.generate(cast.carol.signer()),
        { ...anything, frontier: () => beforeDemotion },
      );

      await alice.engine.createGroup(COMMUNITY);
      await mallory.engine.publishKeyPackages(COMMUNITY);
      await publishWelcome(
        'carol',
        await lookAlike.add([keyPackageOf('mallory')]),
        'mallory',
      );
      demoteCarol();

      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(false);
    });

    it('refuses a welcome a member signed into a look-alike group when the node names a manager its author', async () => {
      roster.add(id('mallory'));
      const alice = engineFor('alice');
      const mallory = engineFor('mallory');
      const lookAlike = await MlsGroup.create(
        COMMUNITY,
        await MlsKeyPackage.generate(cast.bob.signer()),
        { ...anything, frontier: () => headsNow() },
      );

      await alice.engine.createGroup(COMMUNITY);
      await alice.engine.publishKeyPackages(COMMUNITY);
      await mallory.engine.publishKeyPackages(COMMUNITY);
      await publishWelcome(
        'alice',
        await lookAlike.add([keyPackageOf('alice'), keyPackageOf('mallory')]),
        'mallory',
      );

      await expect(mallory.engine.sync(COMMUNITY)).resolves.toBe(true);
      await expect(mallory.engine.hasGroup(COMMUNITY)).resolves.toBe(false);
    });
  });

  it('rejects the removal of a listed member by someone who may not kick', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await carol.engine.sync(COMMUNITY);
    await bob.engine.sync(COMMUNITY);
    const forged = await (
      await rogueGroupOf('carol', carol.store)
    ).removeIdentities([id('bob')]);

    await publishCommit(
      'carol',
      forged as { commit: Uint8Array; epoch: bigint },
    );

    await expect(bob.engine.sync(COMMUNITY)).resolves.toBe(true);
    await alice.engine.sync(COMMUNITY);
    await expect(alice.engine.identities(COMMUNITY)).resolves.toContain(
      id('bob'),
    );
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'bob stays');

    await expect(bob.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'bob stays',
    );
  });

  it('refuses a welcome into a look-alike group made by a member who may not add', async () => {
    const alice = engineFor('alice');
    const carol = engineFor('carol');
    const bobKey = await MlsKeyPackage.generate(cast.bob.signer());
    const lookAlike = await MlsGroup.create(COMMUNITY, bobKey, anything);

    await alice.engine.createGroup(COMMUNITY);
    await carol.engine.publishKeyPackages(COMMUNITY);
    await publishWelcome(
      'bob',
      await lookAlike.add([keyPackageOf('carol')]),
      'carol',
    );

    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(carol.engine.hasGroup(COMMUNITY)).resolves.toBe(false);

    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await carol.engine.sync(COMMUNITY);
    const ciphertext = await alice.engine.encrypt(COMMUNITY, 'the real one');

    await expect(carol.engine.decrypt(COMMUNITY, ciphertext)).resolves.toBe(
      'the real one',
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
    const forged = await MlsKeyPackage.generate(
      new MlsLeafSigner(
        cast.bob.owner('d9'),
        cast.mallory.keyPair,
        cast.bob.deviceKeyPair('d9'),
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

  it('names the epoch each call media key was exported in', async () => {
    const { alice, bob } = await admitBob();
    const first = await secretOf(alice);
    const carol = engineFor('carol');

    await expect(secretOf(bob)).resolves.toEqual(first);
    await carol.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);
    await bob.engine.sync(COMMUNITY);
    const second = await secretOf(bob);

    expect(second.epoch).toBe(first.epoch + 1);
    expect(second.secret).not.toEqual(first.secret);
    await expect(secretOf(alice)).resolves.toEqual(second);
  });

  it('abandons its own commit when publishing it fails, so it stays in the epoch the others are in', async () => {
    const { alice, bob, carol } = await admitCarol();
    const before = await secretOf(bob);

    roster.delete(id('carol'));
    failCommits(new Error('node unavailable'));
    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'node unavailable',
    );
    delete node.hooks.beforePublish;
    const restarted = engineFor('alice', alice.store);

    for (const member of [alice, restarted]) {
      await expect(secretOf(member)).resolves.toEqual(before);
    }
    const sameEpoch = await alice.engine.encrypt(COMMUNITY, 'same epoch');

    await expect(bob.engine.decrypt(COMMUNITY, sameEpoch)).resolves.toBe(
      'same epoch',
    );
    await alice.engine.remove(COMMUNITY, [id('carol')]);
    await bob.engine.sync(COMMUNITY);

    await expect(secretOf(bob)).resolves.not.toEqual(before);
    await expect(secretOf(bob)).resolves.toEqual(await secretOf(alice));
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(false);
  });

  it('adopts its own published commit after stopping before it saved the group', async () => {
    const { alice, bob, carol } = await admitCarol();
    const saveGroup = alice.store.saveGroup.bind(alice.store);
    let published = false;

    node.hooks.afterPublish = (record) => {
      published ||= record.kind === 'commit';
    };
    jest
      .spyOn(alice.store, 'saveGroup')
      .mockImplementation((groupId, state) =>
        published && groupId === COMMUNITY
          ? Promise.reject(new Error('crash'))
          : saveGroup(groupId, state),
      );
    roster.delete(id('carol'));

    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'crash',
    );
    jest.mocked(alice.store.saveGroup).mockRestore();
    const restarted = engineFor('alice', alice.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    await bob.engine.sync(COMMUNITY);
    await expect(secretOf(restarted)).resolves.toEqual(await secretOf(bob));
    const sealed = await restarted.engine.encrypt(
      COMMUNITY,
      'after the restart',
    );

    await expect(bob.engine.decrypt(COMMUNITY, sealed)).resolves.toBe(
      'after the restart',
    );
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(false);
  });

  it('stays in its epoch after stopping before it published, and makes the change again', async () => {
    const { alice, bob, carol } = await admitCarol();
    const before = await secretOf(bob);

    roster.delete(id('carol'));
    failCommits(new Error('crash'));
    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'crash',
    );
    delete node.hooks.beforePublish;
    const restarted = engineFor('alice', alice.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(secretOf(restarted)).resolves.toEqual(before);
    await expect(restarted.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await bob.engine.sync(COMMUNITY);

    await expect(secretOf(restarted)).resolves.not.toEqual(before);
    await expect(secretOf(bob)).resolves.toEqual(await secretOf(restarted));
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(false);
  });

  it('sends the welcome of an admission again after stopping before it was published', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');

    await carol.engine.publishKeyPackages(COMMUNITY);
    node.hooks.beforePublish = (input) => {
      if (input.kind === 'welcome') throw new Error('crash');
    };
    await expect(alice.engine.admit(COMMUNITY, [id('carol')])).rejects.toThrow(
      'crash',
    );
    delete node.hooks.beforePublish;
    const restarted = engineFor('alice', alice.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    await bob.engine.sync(COMMUNITY);
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(true);
    const sealed = await restarted.engine.encrypt(COMMUNITY, 'welcome carol');

    await expect(carol.engine.decrypt(COMMUNITY, sealed)).resolves.toBe(
      'welcome carol',
    );
    await expect(bob.engine.decrypt(COMMUNITY, sealed)).resolves.toBe(
      'welcome carol',
    );
  });

  it('drops its pending commit when the node serves other bytes under its record id, and makes the change again', async () => {
    const { alice, bob, carol } = await admitCarol();
    const before = await secretOf(bob);

    roster.delete(id('carol'));
    loseCommitAnswer();
    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'answer lost',
    );
    const [stored] = commitsAt(before.epoch);

    stored.payload = base64(new Uint8Array([1, 2, 3]));
    const restarted = engineFor('alice', alice.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(secretOf(restarted)).resolves.toEqual(before);
    await expect(pendingIn(alice.store)).resolves.toBe(0);
    await expect(restarted.engine.reconcile(COMMUNITY)).resolves.toBe(true);
    await bob.engine.sync(COMMUNITY);

    await expect(secretOf(restarted)).resolves.not.toEqual(before);
    await expect(secretOf(bob)).resolves.toEqual(await secretOf(restarted));
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(false);
  });

  it('forgets a stored pending commit whose bytes are not those of its record id, without adopting it', async () => {
    const { alice } = await admitCarol();
    const before = await secretOf(alice);

    roster.delete(id('carol'));
    loseCommitAnswer();
    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'answer lost',
    );
    const key = `${COMMUNITY}#pending`;
    const pending = JSON.parse(
      new TextDecoder().decode(await alice.store.loadGroup(key)),
    ) as { payload: string };

    await alice.store.saveGroup(
      key,
      new TextEncoder().encode(
        JSON.stringify({ ...pending, payload: base64(new Uint8Array([1])) }),
      ),
    );
    const restarted = engineFor('alice', alice.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    await expect(pendingIn(alice.store)).resolves.toBe(0);
    await expect(secretOf(restarted)).resolves.toEqual(before);
  });

  it('catches up before it admits, so admitting again keeps the commit the node already holds', async () => {
    const { alice, bob } = await admitBob();
    const carol = engineFor('carol');
    const { epoch } = await secretOf(alice);

    await carol.engine.publishKeyPackages(COMMUNITY);
    loseCommitAnswer();
    await expect(alice.engine.admit(COMMUNITY, [id('carol')])).rejects.toThrow(
      'answer lost',
    );
    await alice.engine.admit(COMMUNITY, [id('carol')]);

    expect(commitsAt(epoch)).toHaveLength(1);
    await bob.engine.sync(COMMUNITY);
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(true);
    const sealed = await alice.engine.encrypt(COMMUNITY, 'admitted once');

    for (const member of [bob, carol]) {
      await expect(member.engine.decrypt(COMMUNITY, sealed)).resolves.toBe(
        'admitted once',
      );
    }
  });

  it('catches up before it removes, so removing again keeps the commit the node already holds', async () => {
    const { alice, bob, carol } = await admitCarol();
    const { epoch } = await secretOf(alice);

    roster.delete(id('carol'));
    loseCommitAnswer();
    await expect(alice.engine.remove(COMMUNITY, [id('carol')])).rejects.toThrow(
      'answer lost',
    );
    await alice.engine.remove(COMMUNITY, [id('carol')]);

    expect(commitsAt(epoch)).toHaveLength(1);
    await bob.engine.sync(COMMUNITY);
    await expect(secretOf(bob)).resolves.toEqual(await secretOf(alice));
    await expect(carol.engine.sync(COMMUNITY)).resolves.toBe(false);
  });

  it('forgets its pending commit and the welcome in it once removed, and sends none of it when admitted again', async () => {
    moderators.add(id('carol'));
    roster.add(id('mallory'));
    const { alice, carol } = await admitCarol();
    const mallory = engineFor('mallory');

    await mallory.engine.publishKeyPackages(COMMUNITY);
    failWelcomes();
    await expect(
      carol.engine.admit(COMMUNITY, [id('mallory')]),
    ).rejects.toThrow('crash');
    delete node.hooks.beforePublish;
    roster.delete(id('carol'));
    await alice.engine.sync(COMMUNITY);
    await alice.engine.remove(COMMUNITY, [id('carol')]);
    stopBeforeForgettingPending(carol.store);
    await expect(carol.engine.sync(COMMUNITY)).rejects.toThrow('crash');
    jest.mocked(carol.store.saveGroup).mockRestore();
    const restarted = engineFor('carol', carol.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(false);
    await expect(pendingIn(carol.store)).resolves.toBe(0);

    const resent = welcomesTo('mallory');

    roster.add(id('carol'));
    await restarted.engine.publishKeyPackages(COMMUNITY);
    await alice.engine.admit(COMMUNITY, [id('carol')]);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    expect(resent).toEqual([]);
    await expect(pendingIn(carol.store)).resolves.toBe(0);
  });

  it('remembers across a restart which commit its group took, so it sends no welcome of a commit that lost the epoch', async () => {
    moderators.add(id('carol'));
    roster.add(id('mallory'));
    const { alice, carol } = await admitCarol();
    const mallory = engineFor('mallory');

    await mallory.engine.publishKeyPackages(COMMUNITY);
    failWelcomes();
    await expect(
      carol.engine.admit(COMMUNITY, [id('mallory')]),
    ).rejects.toThrow('crash');
    delete node.hooks.beforePublish;
    // Alice removes bob in that epoch before the node lists carol's add to
    // her; her commit binds the kick, more roster history, so it wins.
    const [add] = node.records.splice(
      node.records.findIndex(
        (record) =>
          record.kind === 'commit' && record.authorIdentityId === id('carol'),
      ),
      1,
    );

    roster.delete(id('bob'));
    await alice.engine.remove(COMMUNITY, [id('bob')]);
    node.records.push(add);
    stopBeforeForgettingPending(carol.store);
    await expect(carol.engine.sync(COMMUNITY)).rejects.toThrow('crash');
    jest.mocked(carol.store.saveGroup).mockRestore();
    const resent = welcomesTo('mallory');
    const restarted = engineFor('carol', carol.store);

    await expect(restarted.engine.sync(COMMUNITY)).resolves.toBe(true);
    expect(resent).toEqual([]);
    await expect(pendingIn(carol.store)).resolves.toBe(0);
    await expect(secretOf(restarted)).resolves.toEqual(await secretOf(alice));
    const sealed = await alice.engine.encrypt(COMMUNITY, 'one branch');

    await expect(restarted.engine.decrypt(COMMUNITY, sealed)).resolves.toBe(
      'one branch',
    );
  });

  it('keeps a restricted channel group to the members who may see the channel', async () => {
    const group = restrictChannel(['bob']);
    const { alice, bob, carol } = await openChannel(group);
    const ciphertext = await alice.engine.encrypt(group, 'for viewers');

    await expect(alice.engine.identities(group)).resolves.toEqual([
      id('alice'),
      id('bob'),
    ]);
    await expect(carol.engine.hasGroup(group)).resolves.toBe(false);
    await expect(bob.engine.decrypt(group, ciphertext)).resolves.toBe(
      'for viewers',
    );
    await expect(carol.engine.decrypt(group, ciphertext)).rejects.toThrow();
    await expect(carol.engine.callMediaKey(group, 'call-1')).rejects.toThrow();
    expect(MlsCommunityEngine.groupOf(ciphertext)).toBe(group);
  });

  it('removes a member who loses the channel role from every later epoch', async () => {
    const group = restrictChannel(['bob', 'carol']);
    const { alice, bob, carol } = await openChannel(group);

    await expect(alice.engine.identities(group)).resolves.toContain(
      id('carol'),
    );

    historyOf().assign(cast.alice, cast.carol, []);
    await expect(bob.engine.reconcile(group)).resolves.toBe(true);
    await expect(carol.engine.sync(group)).resolves.toBe(false);
    await alice.engine.sync(group);
    const ciphertext = await alice.engine.encrypt(group, 'carol must not read');

    await expect(bob.engine.decrypt(group, ciphertext)).resolves.toBe(
      'carol must not read',
    );
    await expect(carol.engine.decrypt(group, ciphertext)).rejects.toThrow();
    await expect(carol.engine.callMediaKey(group, 'call-1')).rejects.toThrow();
  });

  it('keeps a stock of key packages for each group it publishes them to', async () => {
    const group = restrictChannel(['bob']);
    const { engine } = engineFor('bob');
    const published = (groupId: string): number =>
      node.records.filter(
        (record) => record.kind === 'key_package' && record.groupId === groupId,
      ).length;

    await engine.publishKeyPackages(COMMUNITY);
    await engine.publishKeyPackages(group);
    await engine.publishKeyPackages(group);

    expect([published(COMMUNITY), published(group)]).toEqual([4, 4]);
  });

  it('names the group a ciphertext was sent in, and none for anything else', async () => {
    const { alice } = await admitBob();

    expect(
      MlsCommunityEngine.groupOf(await alice.engine.encrypt(COMMUNITY, 'hi')),
    ).toBe(COMMUNITY);
    expect(MlsCommunityEngine.groupOf(base64(new Uint8Array([1, 2])))).toBe(
      undefined,
    );
  });

  describe('commits an update of its own leaf on a cadence', () => {
    const DAY = MlsUpdateCadence.INTERVAL_MS;
    const commitsBy = (name: string): MlsRecordResource[] =>
      node.records.filter(
        (record) =>
          record.kind === 'commit' && record.authorIdentityId === id(name),
      );
    /**
     * Bob's state as it was, read with alice's next message once bob's
     * own update has gone out: a leaked copy must lose the group.
     */
    const expectLockedOut = async (
      leaked: MlsGroup,
      alice: ReturnType<typeof engineFor>,
      update: MlsRecordResource,
    ): Promise<void> => {
      await alice.engine.sync(COMMUNITY);
      const after = await alice.engine.encrypt(COMMUNITY, 'after');

      await leaked
        .applyCommit({
          bytes: Buffer.from(update.payload, 'base64'),
          epoch: BigInt(update.epoch as number),
          id: update.recordId,
        })
        .catch(() => undefined);

      await expect(
        leaked.decrypt(Buffer.from(after, 'base64')),
      ).rejects.toThrow();
      expect(await leaked.callMediaKey('epoch')).not.toEqual(
        (await secretOf(alice)).secret,
      );
    };

    it('commits one update before the first message sent a day after the last', async () => {
      const { alice, bob } = await admitBob();
      const leaked = await rogueGroupOf('bob', bob.store);
      const before = await alice.engine.encrypt(COMMUNITY, 'before');

      expect(
        new TextDecoder().decode(
          await leaked.decrypt(Buffer.from(before, 'base64')),
        ),
      ).toBe('before');
      jitter = 0.5;
      now += DAY;
      await bob.engine.encrypt(COMMUNITY, 'within a day');

      expect(commitsBy('bob')).toHaveLength(0);

      now += MlsUpdateCadence.JITTER_MS + 1;
      const { epoch } = await secretOf(bob);
      const message = await bob.engine.encrypt(COMMUNITY, 'a day later');
      const [update] = commitsBy('bob');

      expect(commitsBy('bob')).toHaveLength(1);
      expect(update.epoch).toBe(epoch);
      expect(MlsGroup.epochOf(Buffer.from(message, 'base64'))).toBe(
        BigInt(epoch + 1),
      );
      await alice.engine.sync(COMMUNITY);
      await expect(alice.engine.decrypt(COMMUNITY, message)).resolves.toBe(
        'a day later',
      );
      await bob.engine.encrypt(COMMUNITY, 'right after');
      expect(commitsBy('bob')).toHaveLength(1);
      await expectLockedOut(leaked, alice, update);
    });

    it('commits one update before the message after the thousandth since the last', async () => {
      const { alice, bob } = await admitBob();
      const leaked = await rogueGroupOf('bob', bob.store);

      for (let sent = 0; sent < MlsUpdateCadence.MAX_SENT; sent += 1) {
        await bob.engine.encrypt(COMMUNITY, 'chatter');
      }

      expect(commitsBy('bob')).toHaveLength(0);

      const message = await bob.engine.encrypt(COMMUNITY, 'one more');
      const [update] = commitsBy('bob');

      expect(commitsBy('bob')).toHaveLength(1);
      await alice.engine.sync(COMMUNITY);
      await expect(alice.engine.decrypt(COMMUNITY, message)).resolves.toBe(
        'one more',
      );
      await expectLockedOut(leaked, alice, update);
    }, 120_000);

    it('updates on the first reconcile of a device that comes back after a day', async () => {
      const { alice, bob } = await admitBob();
      const leaked = await rogueGroupOf('bob', bob.store);

      now += DAY + MlsUpdateCadence.JITTER_MS;
      await bob.engine.reconcile(COMMUNITY);
      const [update] = commitsBy('bob');

      expect(commitsBy('bob')).toHaveLength(1);
      await expectLockedOut(leaked, alice, update);
    });

    it('restarts the cadence on a removal it commits, but not on an add', async () => {
      const { alice } = await admitBob();
      const carol = engineFor('carol');

      now += DAY + MlsUpdateCadence.JITTER_MS;
      await carol.engine.publishKeyPackages(COMMUNITY);
      await alice.engine.admit(COMMUNITY, [id('carol')]);
      await alice.engine.encrypt(COMMUNITY, 'after the add');

      expect(commitsBy('alice')).toHaveLength(3);

      now += DAY + MlsUpdateCadence.JITTER_MS;
      await alice.engine.remove(COMMUNITY, [id('carol')]);
      await alice.engine.encrypt(COMMUNITY, 'after the removal');

      expect(commitsBy('alice')).toHaveLength(4);
    });

    it('resolves concurrent updates of two devices to one epoch on both, and the loser updates again', async () => {
      const { alice, bob } = await admitBob();

      now += DAY + MlsUpdateCadence.JITTER_MS;
      await alice.engine.encrypt(COMMUNITY, 'from alice');
      // Bob updates before the node lists alice's update to him.
      const [hidden] = node.records.splice(
        node.records.indexOf(commitsBy('alice')[1]),
        1,
      );

      await bob.engine.encrypt(COMMUNITY, 'from bob');
      node.records.push(hidden);

      expect(
        [...commitsBy('alice'), ...commitsBy('bob')].map(
          (record) => record.epoch,
        ),
      ).toEqual([0, 1, 1]);
      await alice.engine.sync(COMMUNITY);
      await bob.engine.sync(COMMUNITY);

      expect(await secretOf(alice)).toEqual(await secretOf(bob));

      const committed = node.records.filter(
        (record) => record.kind === 'commit',
      ).length;
      const fromAlice = await alice.engine.encrypt(COMMUNITY, 'again alice');
      const fromBob = await bob.engine.encrypt(COMMUNITY, 'again bob');

      expect(
        node.records.filter((record) => record.kind === 'commit'),
      ).toHaveLength(committed + 1);
      await alice.engine.sync(COMMUNITY);
      await bob.engine.sync(COMMUNITY);
      expect(await secretOf(alice)).toEqual(await secretOf(bob));
      await expect(alice.engine.decrypt(COMMUNITY, fromBob)).resolves.toBe(
        'again bob',
      );
      await expect(bob.engine.decrypt(COMMUNITY, fromAlice)).resolves.toBe(
        'again alice',
      );
    });
  });
});
