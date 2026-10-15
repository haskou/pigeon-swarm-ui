import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { CommunityMlsRoster } from '../../domain/CommunityMlsRoster';
import type { MlsRecordResource } from '../http/resources/MlsRecordResource';
import type {
  MlsCommitOutput,
  MlsKeyPackageBundle,
  MlsLeafOwner,
} from './MlsGroup';
import type { MlsGroupCredentials } from './MlsGroupCredentials';
import type { MlsLeafSigner } from './MlsLeafSigner';
import type { MlsMembershipPolicy } from './MlsMembershipPolicy';
import type { MlsRecordTransport } from './MlsRecordTransport';
import type { MlsRoster } from './MlsRoster';
import type { MlsStateStore } from './MlsStateStore';

import { CommunityRosterHistory } from '../../domain/CommunityRosterHistory';
import { deriveMlsRecordId } from '../http/deriveMlsRecordId';
import {
  generateMlsKeyPackage,
  MlsGroup,
  mlsKeyPackageOwner,
  restoreMlsKeyPackage,
} from './MlsGroup';
import { MlsRejectedError } from './MlsRejectedError';

const KEY_PACKAGE_TARGET = 4;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64'));

/**
 * A commit this device made, kept aside from before it is published until
 * the group has left the epoch it was made in.
 */
interface PendingCommit {
  /** The record id the commit is published under. */
  commitId: string;
  /** The epoch the commit was made in. */
  epoch: number;
  /** Base64 group state the commit leads to. */
  state: string;
  /** The roster revision the commit binds. */
  frontier: string[];
  /** The welcome for the devices the commit adds, and who gets it. */
  welcome?: { payload: string; recipientIdentityIds: string[] };
}

/** The device a record's key package belongs to, if its author signed it. */
const authoredOwnerOf = (
  record: MlsRecordResource,
): MlsLeafOwner | undefined => {
  try {
    const owner = mlsKeyPackageOwner(fromBase64(record.payload));

    return owner.identityId === record.authorIdentityId ? owner : undefined;
  } catch {
    return undefined;
  }
};

/** Ignores key packages whose credential the author's identity did not sign. */
const pickNewestPerDevice = (
  published: MlsRecordResource[],
  wanted: ReadonlySet<string>,
  present: ReadonlySet<string>,
): Map<string, MlsRecordResource> => {
  const chosen = new Map<string, MlsRecordResource>();

  for (const record of published) {
    if (!wanted.has(record.authorIdentityId)) continue;
    const owner = authoredOwnerOf(record);

    if (!owner) continue;
    const device = `${owner.identityId}/${owner.deviceCredential}`;
    const known = chosen.get(device);

    if (present.has(device)) continue;

    if (!known || known.createdAt < record.createdAt)
      chosen.set(device, record);
  }

  return chosen;
};

/**
 * One device's MLS state for every group it belongs to. All mutation of a
 * group goes through a per-group queue so the ratchet has a single writer.
 */
export class MlsCommunityEngine {
  private readonly groups = new Map<string, MlsGroup>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly histories = new Map<string, CommunityRosterHistory>();

  /** Where the commit this device is publishing waits until it settles. */
  private static pendingKey(groupId: string): string {
    return `${groupId}#pending`;
  }

  /** Where the roster revision the stored group bound is kept. */
  private static frontierKey(groupId: string): string {
    return `${groupId}#frontier`;
  }

  /**
   * The group an encrypted message was sent in, as the message names it;
   * undefined for anything that is not one.
   */
  public static groupOf(ciphertext: string): string | undefined {
    return MlsGroup.groupIdOf(fromBase64(ciphertext));
  }

  public constructor(
    private readonly signer: MlsLeafSigner,
    private readonly store: MlsStateStore,
    private readonly transportFor: (communityId: string) => MlsRecordTransport,
    private readonly rosterFor: (groupId: string) => MlsRoster,
  ) {}

  /** Starts a group with this device as its only leaf. */
  public async createGroup(groupId: string): Promise<void> {
    await this.exclusive(groupId, async () => {
      if (await this.load(groupId)) {
        throw new MlsRejectedError('Group already exists on this device');
      }
      await this.currentHistory(groupId);
      const key = await generateMlsKeyPackage(this.signer);
      const group = await MlsGroup.create(
        groupId,
        key,
        this.policyFor(groupId),
      );

      await this.remember(group);
    });
  }

  public async hasGroup(groupId: string): Promise<boolean> {
    return this.exclusive(groupId, async () =>
      Boolean(await this.load(groupId)),
    );
  }

  /**
   * Publishes key packages for the group until it has a stock of unused
   * ones. Each group has its own stock: one that admits this device never
   * spends another's.
   */
  public async publishKeyPackages(groupId: string): Promise<void> {
    const stored = (await this.store.loadKeyPackages()).filter(
      (keyPackage) => keyPackage.groupId === groupId,
    );
    const missing = KEY_PACKAGE_TARGET - stored.length;

    if (missing <= 0) return;

    const bundles = await this.makeKeyPackages(missing, groupId);

    for (const bundle of bundles) {
      await this.transportFor(this.communityOf(groupId)).publish({
        groupId,
        kind: 'key_package',
        payload: toBase64(bundle.publicBytes),
      });
    }
  }

  /**
   * Brings the group up to date: joins from a welcome when this device has no
   * state, or was removed and has been admitted again, then applies commits
   * in order. Returns false once this device has been removed.
   */
  public async sync(groupId: string): Promise<boolean> {
    return this.exclusive(groupId, async () => {
      const communityId = this.communityOf(groupId);
      const previous = await this.load(groupId);

      const history = await this.currentHistory(groupId);
      const group =
        previous && !previous.isRemoved
          ? previous
          : ((await this.joinFromWelcome(groupId, communityId, {
              history,
              previous,
            })) ?? previous);

      if (!group) return true;

      if (group.isRemoved) return false;
      const pending = await this.loadPending(groupId);
      const { group: synced, taken } = await this.applyCommits(
        group,
        communityId,
        pending,
      );

      await this.remember(synced);
      await this.settle(synced, pending, taken);

      return !synced.isRemoved;
    });
  }

  /** Adds every device of the identities that published a key package. */
  public async admit(groupId: string, identityIds: string[]): Promise<void> {
    await this.exclusive(groupId, async () => {
      const group = await this.requireGroup(groupId);
      const communityId = this.communityOf(groupId);
      const transport = this.transportFor(communityId);
      const present = new Set(
        group
          .leaves()
          .map(({ owner }) => `${owner.identityId}/${owner.deviceCredential}`),
      );
      const wanted = new Set(identityIds);
      const published = await transport.list({
        groupId,
        kind: 'key_package',
      });
      const chosen = pickNewestPerDevice(published, wanted, present);

      if (chosen.size === 0) return;

      const output = await group.add(
        [...chosen.values()].map((record) => fromBase64(record.payload)),
      );

      await this.commit(group, output, [
        ...new Set([...chosen.values()].map((r) => r.authorIdentityId)),
      ]);
    });
  }

  /** Removes every leaf of the identities. No-op when none are present. */
  public async remove(groupId: string, identityIds: string[]): Promise<void> {
    await this.exclusive(groupId, async () => {
      const group = await this.requireGroup(groupId);
      const output = await group.removeIdentities(identityIds);

      if (!output) return;
      await this.commit(group, output, []);
    });
  }

  /**
   * Makes the group follow the signed roster: removes leaves whose identity
   * left, was kicked or banned, and, when this identity may add members,
   * admits every device of the roster that published a key package and
   * binds the latest roster revision (`bindRoster`). A group waiting for
   * roster operations the node withholds (`MlsGroup.waiting`) commits
   * nothing. Safe to run on every member; duplicates resolve by commit id.
   * Returns false once this device is no longer in the group.
   */
  public async reconcile(groupId: string): Promise<boolean> {
    if (!(await this.sync(groupId))) return false;
    const group = await this.exclusive(groupId, () => this.load(groupId));

    if (!group || group.waiting) return true;

    const roster = (await this.currentHistory(groupId)).latest();
    const me = this.signer.owner.identityId;

    if (roster.has(me)) {
      const stale = (await this.identities(groupId)).filter(
        (identity) => !roster.has(identity),
      );

      if (stale.length > 0) await this.remove(groupId, stale);

      if (roster.manages(me)) {
        await this.admit(groupId, roster.participants());
        await this.bindRoster(groupId);
      }
    }

    return this.sync(groupId);
  }

  /** Identities holding a leaf. */
  public async identities(groupId: string): Promise<string[]> {
    return this.exclusive(groupId, async () =>
      (await this.requireGroup(groupId)).identities(),
    );
  }

  /** Public leaf credentials of the local group; null without one. */
  public async credentials(
    groupId: string,
  ): Promise<MlsGroupCredentials | null> {
    return this.exclusive(groupId, async () => {
      const group = await this.load(groupId);

      return group ? { epoch: group.epoch, leaves: group.leaves() } : null;
    });
  }

  /** Returns base64 ciphertext and keeps the plaintext on this device. */
  public async encrypt(groupId: string, plaintext: string): Promise<string> {
    return this.exclusive(groupId, async () => {
      const group = await this.requireGroup(groupId);
      const ciphertext = toBase64(
        await group.encrypt(encoder.encode(plaintext)),
      );

      // The sender cannot decrypt its own message later; keep it first.
      await this.store.savePlaintext(groupId, this.idOf(ciphertext), plaintext);
      await this.remember(group);

      return ciphertext;
    });
  }

  /** Idempotent: the same ciphertext always yields the stored plaintext. */
  public async decrypt(groupId: string, ciphertext: string): Promise<string> {
    return this.exclusive(groupId, async () => {
      const id = this.idOf(ciphertext);
      const cached = await this.store.loadPlaintext(groupId, id);

      if (cached !== undefined) return cached;
      const group = await this.requireGroup(groupId);
      const plaintext = decoder.decode(
        await group.decrypt(fromBase64(ciphertext)),
      );

      // Persist the plaintext before the advanced ratchet: losing the state
      // is recoverable; a message that cannot be decrypted again is not.
      await this.store.savePlaintext(groupId, id, plaintext);
      await this.remember(group);

      return plaintext;
    });
  }

  public async exportSecret(
    groupId: string,
    label: string,
    context: string,
  ): Promise<Uint8Array> {
    return this.exclusive(groupId, async () =>
      (await this.requireGroup(groupId)).exportSecret(
        label,
        encoder.encode(context),
      ),
    );
  }

  /**
   * Commits a leaf update when the roster revision the group bound grants
   * other rights than the latest one, or when the group took leaves a
   * member added that the latest roster no longer lets add members and no
   * member it does has committed since (`unvouched`). Until a commit binds a
   * demotion, the demoted member can still bind an older revision, and
   * whoever it added cannot open its welcome (`open`); this closes both as
   * soon as a manager sees the demotion.
   */
  private async bindRoster(groupId: string): Promise<void> {
    await this.exclusive(groupId, async () => {
      const group = await this.requireGroup(groupId);
      const history = await this.currentHistory(groupId);
      const bound = history.rosterAt(group.frontier);
      const latest = history.latest();

      // A revision this device cannot resolve is one it cannot follow yet.
      if (!bound) return;

      if (bound.sameAuthorityAs(latest) && !this.unvouched(group, latest)) {
        return;
      }
      await this.commit(group, await group.update(), []);
    });
  }

  /**
   * Whether leaves the group took since it was loaded were added by a
   * member the latest roster does not let add members, with no commit
   * since by one it does.
   */
  private unvouched(group: MlsGroup, latest: CommunityMlsRoster): boolean {
    return group
      .changes()
      .reduce<boolean>(
        (stranded, { added, committer }) =>
          !latest.manages(committer) && (stranded || added.length > 0),
        false,
      );
  }

  /**
   * Publishes a commit this device made, then keeps it. The group the
   * commit leads to is set aside as pending while the stored group stays
   * in its epoch; only once the node holds the commit is the group
   * advanced and saved. A commit whose publishing fails is abandoned: the
   * group, its stored state and every secret derived from it stay in the
   * epoch the other members are in. The pending is kept, since a commit
   * whose answer was lost may still have reached the node: `sync` adopts
   * it if it shows up there and forgets it once the epoch moved on. The
   * welcome is sent after the commit and stays pending until it is.
   */
  private async commit(
    group: MlsGroup,
    output: MlsCommitOutput,
    recipientIdentityIds: string[],
  ): Promise<void> {
    const transport = this.transportFor(this.communityOf(group.groupId));
    const input = {
      epoch: Number(output.epoch),
      groupId: group.groupId,
      kind: 'commit' as const,
      payload: toBase64(output.commit),
    };
    const { frontier, state } = group.pendingState();
    const pending: PendingCommit = {
      commitId: deriveMlsRecordId(input),
      epoch: input.epoch,
      frontier: [...frontier],
      state: toBase64(state),
      ...(output.welcome &&
        recipientIdentityIds.length > 0 && {
          welcome: { payload: toBase64(output.welcome), recipientIdentityIds },
        }),
    };

    try {
      await this.savePending(group.groupId, pending);
      const record = await transport.publish(input);

      if (record.recordId !== pending.commitId) {
        throw new MlsRejectedError('Node returned a different record id');
      }
    } catch (error) {
      group.abandon();
      throw error;
    }
    group.confirm(pending.commitId);
    await this.remember(group);
    await this.sendWelcome(transport, group.groupId, pending);
    await this.store.saveGroup(
      MlsCommunityEngine.pendingKey(group.groupId),
      new Uint8Array(),
    );
  }

  private async sendWelcome(
    transport: MlsRecordTransport,
    groupId: string,
    { epoch, welcome }: PendingCommit,
  ): Promise<void> {
    if (!welcome) return;

    for (const recipientIdentityId of welcome.recipientIdentityIds) {
      await transport.publish({
        epoch,
        groupId,
        kind: 'welcome',
        payload: welcome.payload,
        recipientIdentityId,
      });
    }
  }

  private async savePending(
    groupId: string,
    pending: PendingCommit,
  ): Promise<void> {
    await this.store.saveGroup(
      MlsCommunityEngine.pendingKey(groupId),
      encoder.encode(JSON.stringify(pending)),
    );
  }

  private async loadPending(
    groupId: string,
  ): Promise<PendingCommit | undefined> {
    const bytes = await this.store.loadGroup(
      MlsCommunityEngine.pendingKey(groupId),
    );

    return bytes?.length
      ? (JSON.parse(decoder.decode(bytes)) as PendingCommit)
      : undefined;
  }

  /**
   * Once the group left the epoch of this device's pending commit: sends
   * the welcome again when that commit is the one the group took, then
   * forgets it. While the group is still in that epoch the commit may yet
   * reach the other members, so it stays.
   */
  private async settle(
    group: MlsGroup,
    pending: PendingCommit | undefined,
    taken: string | undefined,
  ): Promise<void> {
    if (!pending) return;
    const epoch = BigInt(pending.epoch);

    if (!group.isRemoved && group.epoch === epoch) return;

    // Nothing taken in this sync: the group was already past the epoch,
    // which only this device's own confirmed commit leaves behind.
    if (
      !group.isRemoved &&
      group.epoch > epoch &&
      (taken ?? pending.commitId) === pending.commitId
    ) {
      await this.sendWelcome(
        this.transportFor(this.communityOf(group.groupId)),
        group.groupId,
        pending,
      );
    }
    await this.store.saveGroup(
      MlsCommunityEngine.pendingKey(group.groupId),
      new Uint8Array(),
    );
  }

  /**
   * Applies the published commits in order (`ordered`); `MlsGroup` switches
   * to a later one the latest verified roster allows over one it does not,
   * and stops while a manager's commit proves operations the node has not
   * served (`MlsGroup.waiting`). A commit
   * the roster does not allow, or that does not open, is skipped: the group
   * stays at its epoch for the next commit, and
   * one member cannot stall everyone else. This device's own pending commit
   * is adopted rather than applied. Returns the group and the id of the
   * commit it took in the pending's epoch.
   */
  private async applyCommits(
    group: MlsGroup,
    communityId: string,
    pending: PendingCommit | undefined,
  ): Promise<{ group: MlsGroup; taken?: string }> {
    const epoch = Number(group.epoch);
    const records = await this.transportFor(communityId).list({
      ...(epoch >= 2 && { afterEpoch: epoch - 2 }),
      groupId: group.groupId,
      kind: 'commit',
    });
    const ordered = this.ordered(group.groupId, records);
    let current = group;
    let taken: string | undefined;

    for (const record of ordered) {
      if (current.isRemoved) break;
      const step = await this.take(current, record, pending);

      current = step.group;

      if (step.took && record.epoch === pending?.epoch) {
        taken = record.recordId;
      }
    }

    return { group: current, taken };
  }

  /**
   * Commits by epoch; in an epoch, one binding roster operations this
   * device has not verified first, then the one binding most roster
   * history, then by id. Commits binding unverified operations are also
   * tried once before every other: a manager's proves the node withholds
   * them, so the group stops before taking a rival in that epoch or a
   * later one.
   */
  private ordered(
    groupId: string,
    records: readonly MlsRecordResource[],
  ): MlsRecordResource[] {
    const history =
      this.histories.get(groupId) ?? CommunityRosterHistory.of([]);
    const ranks = new Map(
      records.map((record) => {
        const frontier = MlsGroup.frontierOf(fromBase64(record.payload)) ?? [];

        return [
          record.recordId,
          {
            reach: history.reach(frontier),
            unverified: history.rosterAt(frontier) === undefined,
          },
        ];
      }),
    );
    const rankOf = (
      record: MlsRecordResource,
    ): { reach: number; unverified: boolean } =>
      ranks.get(record.recordId) ?? { reach: 0, unverified: false };
    const sorted = records
      .filter((record) => record.epoch !== undefined)
      .sort(
        (a, b) =>
          (a.epoch as number) - (b.epoch as number) ||
          Number(rankOf(b).unverified) - Number(rankOf(a).unverified) ||
          rankOf(b).reach - rankOf(a).reach ||
          a.recordId.localeCompare(b.recordId),
      );

    return [...sorted.filter((record) => rankOf(record).unverified), ...sorted];
  }

  /**
   * Adopts the group this device's own pending commit leads to, unless the
   * group waits for withheld roster operations, or applies the commit.
   * `took` tells whether the group took it.
   */
  private async take(
    group: MlsGroup,
    record: MlsRecordResource,
    pending: PendingCommit | undefined,
  ): Promise<{ group: MlsGroup; took: boolean }> {
    if (
      !group.waiting &&
      record.recordId === pending?.commitId &&
      record.epoch === pending.epoch &&
      group.epoch === BigInt(pending.epoch)
    ) {
      return {
        group: MlsGroup.restore(
          group.groupId,
          this.signer.owner,
          this.policyFor(group.groupId),
          fromBase64(pending.state),
          pending.frontier,
        ),
        took: true,
      };
    }

    try {
      const { kind } = await group.applyCommit({
        bytes: fromBase64(record.payload),
        epoch: BigInt(record.epoch as number),
        id: record.recordId,
      });

      return { group, took: kind === 'applied' || kind === 'replaced' };
    } catch {
      // Not allowed by the roster, or not a commit of this group.
      return { group, took: false };
    }
  }

  /**
   * Joins from the newest welcome for this identity that one of this
   * device's key packages opens (`open`). The node names the welcome's
   * author; it must hold a leaf in the welcomed group and be allowed to add
   * members in the roster at the revision the welcome binds, so nobody else
   * can welcome a member into a look-alike group. The key package is kept
   * until a welcome opens, so one waiting for a manager's commit is tried
   * again on the next sync. A removed device only joins an epoch newer than
   * its last membership.
   */
  private async joinFromWelcome(
    groupId: string,
    communityId: string,
    context: { history: CommunityRosterHistory; previous?: MlsGroup },
  ): Promise<MlsGroup | undefined> {
    const { history, previous } = context;
    const welcomes = await this.transportFor(communityId).list({
      groupId,
      kind: 'welcome',
    });
    const mine = welcomes.filter(
      (record) => record.recipientIdentityId === this.signer.owner.identityId,
    );
    const keys = mine.length > 0 ? await this.storedBundles() : [];

    for (const record of mine.sort((a, b) => b.createdAt - a.createdAt)) {
      for (const { bundle, id } of keys) {
        const group = await this.open(groupId, bundle, record, history);

        if (!group || (previous && group.epoch <= previous.epoch)) continue;
        await this.store.deleteKeyPackage(id);
        await this.remember(group);

        return group;
      }
    }

    return undefined;
  }

  /**
   * The group a welcome opens with the key package, if its author is in it
   * and may add members in the roster the welcome binds. When the latest
   * roster no longer lets the author add members, it opens only once a
   * member that roster lets add members has committed in the group after
   * the welcome (`vouched`): every member took the add then, while a
   * demoted manager's look-alike group or late add never gets such a commit.
   */
  private async open(
    groupId: string,
    bundle: MlsKeyPackageBundle,
    record: MlsRecordResource,
    history: CommunityRosterHistory,
  ): Promise<MlsGroup | undefined> {
    const author = record.authorIdentityId;
    let group: MlsGroup;

    try {
      group = await MlsGroup.join(
        groupId,
        bundle,
        fromBase64(record.payload),
        this.policyFor(groupId),
      );
    } catch {
      // Not addressed to this key package, or not a member's welcome.
      return undefined;
    }

    if (
      !history.rosterAt(group.frontier)?.manages(author) ||
      !group.identities().includes(author)
    ) {
      return undefined;
    }

    return history.latest().manages(author)
      ? group
      : this.vouched(group, history);
  }

  /**
   * The joined group with the commits published after its welcome, if one
   * of them is by a member the latest roster lets add members.
   */
  private async vouched(
    group: MlsGroup,
    history: CommunityRosterHistory,
  ): Promise<MlsGroup | undefined> {
    const { group: synced } = await this.applyCommits(
      group,
      this.communityOf(group.groupId),
      undefined,
    );
    const latest = history.latest();

    return synced.changes().some(({ committer }) => latest.manages(committer))
      ? synced
      : undefined;
  }

  /** Key packages kept on this device for the group they are published in. */
  private async makeKeyPackages(
    count: number,
    groupId: string,
  ): Promise<MlsKeyPackageBundle[]> {
    const bundles: MlsKeyPackageBundle[] = [];

    for (let index = 0; index < count; index += 1) {
      const bundle = await generateMlsKeyPackage(this.signer);

      await this.store.saveKeyPackage({
        groupId,
        id: this.idOf(toBase64(bundle.publicBytes)),
        privatePackage: bundle.privatePackage,
        publicBytes: bundle.publicBytes,
      });
      bundles.push(bundle);
    }

    return bundles;
  }

  private async storedBundles(): Promise<
    { bundle: MlsKeyPackageBundle; id: string }[]
  > {
    return (await this.store.loadKeyPackages()).map((stored) => ({
      bundle: restoreMlsKeyPackage(stored.publicBytes, stored.privatePackage),
      id: stored.id,
    }));
  }

  /** Reads the signed roster history again; groups judge by it. */
  private async currentHistory(
    groupId: string,
  ): Promise<CommunityRosterHistory> {
    const history = await this.rosterFor(groupId)();

    this.histories.set(groupId, history);

    return history;
  }

  /**
   * Roster members hold leaves; the roster at the revision a commit or
   * welcome binds decides who may add and remove them (see
   * `CommunityMlsRoster`). This device binds everything it has verified. A
   * revision naming operations it has not verified, bound by a member the
   * latest verified roster lets add members, proves the node withholds
   * them (`MlsGroup.waiting`).
   */
  private policyFor(groupId: string): MlsMembershipPolicy {
    const history = (): CommunityRosterHistory =>
      this.histories.get(groupId) ?? CommunityRosterHistory.of([]);

    return {
      admits: (identityId, frontier) =>
        history().rosterAt(frontier)?.has(identityId) ?? false,
      allows: (change, { baseline, frontier }) =>
        history().follows(frontier, baseline) &&
        (history().rosterAt(frontier)?.allowsCommit(change) ?? false),
      frontier: () => history().heads(),
      reach: (frontier) => history().reach(frontier),
      withheld: (committer, frontier) =>
        history().rosterAt(frontier) === undefined &&
        history().latest().manages(committer),
    };
  }

  private async load(groupId: string): Promise<MlsGroup | undefined> {
    const cached = this.groups.get(groupId);

    if (cached) return cached;
    const bytes = await this.store.loadGroup(groupId);

    if (!bytes) return undefined;
    await this.currentHistory(groupId);
    const frontier = await this.store.loadGroup(
      MlsCommunityEngine.frontierKey(groupId),
    );
    const group = MlsGroup.restore(
      groupId,
      this.signer.owner,
      this.policyFor(groupId),
      bytes,
      frontier ? (JSON.parse(decoder.decode(frontier)) as string[]) : [],
    );

    this.groups.set(groupId, group);

    return group;
  }

  private async requireGroup(groupId: string): Promise<MlsGroup> {
    const group = await this.load(groupId);

    if (!group) throw new MlsRejectedError('This device is not in the group');

    return group;
  }

  private async remember(group: MlsGroup): Promise<void> {
    this.groups.set(group.groupId, group);
    await this.store.saveGroup(group.groupId, group.serialize());
    await this.store.saveGroup(
      MlsCommunityEngine.frontierKey(group.groupId),
      encoder.encode(JSON.stringify(group.frontier)),
    );
  }

  private communityOf(groupId: string): string {
    return groupId.split(':')[0];
  }

  private idOf(value: string): string {
    return SHA256Hash.from(value).toString();
  }

  private async exclusive<T>(
    groupId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.queues.get(groupId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);

    this.queues.set(groupId, next);

    return next;
  }
}
