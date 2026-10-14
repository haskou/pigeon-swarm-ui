import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

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

import { CommunityMlsRoster } from '../../domain/CommunityMlsRoster';
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
    const device = `${owner.identityId}/${owner.deviceId}`;
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
  private readonly rosters = new Map<string, CommunityMlsRoster>();

  /** Where the commit this device is publishing waits until it settles. */
  private static pendingKey(groupId: string): string {
    return `${groupId}#pending`;
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
      await this.currentRoster(groupId);
      const [key] = await this.makeKeyPackages(1, false);
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

  /** Publishes key packages until a stock of unused ones is available. */
  public async publishKeyPackages(communityId: string): Promise<void> {
    const stored = await this.store.loadKeyPackages();
    const missing = KEY_PACKAGE_TARGET - stored.length;

    if (missing <= 0) return;

    const bundles = await this.makeKeyPackages(missing, true);

    for (const bundle of bundles) {
      await this.transportFor(communityId).publish({
        groupId: communityId,
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

      const roster = await this.currentRoster(groupId);
      const group =
        previous && !previous.isRemoved
          ? previous
          : ((await this.joinFromWelcome(groupId, communityId, {
              previous,
              roster,
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
          .map(({ owner }) => `${owner.identityId}/${owner.deviceId}`),
      );
      const wanted = new Set(identityIds);
      const published = await transport.list({
        groupId: communityId,
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
   * admits every device of the roster that published a key package. Safe to
   * run on every member; duplicates resolve by commit id. Returns false once
   * this device is no longer in the group.
   */
  public async reconcile(groupId: string): Promise<boolean> {
    if (!(await this.sync(groupId))) return false;

    if (!(await this.hasGroup(groupId))) return true;

    const roster = await this.currentRoster(groupId);
    const me = this.signer.owner.identityId;

    if (roster.has(me)) {
      const stale = (await this.identities(groupId)).filter(
        (identity) => !roster.has(identity),
      );

      if (stale.length > 0) await this.remove(groupId, stale);

      if (roster.manages(me)) await this.admit(groupId, roster.participants());
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
    const pending: PendingCommit = {
      commitId: deriveMlsRecordId(input),
      epoch: input.epoch,
      state: toBase64(group.pendingState()),
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
   * Applies the published commits in order. A commit the roster does not
   * allow, or that does not open, is skipped: the group stays at its epoch
   * for the next commit, and one member cannot stall everyone else. This
   * device's own pending commit is adopted rather than applied. Returns
   * the group and the id of the commit it took in the pending's epoch.
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
    const ordered = records
      .filter((record) => record.epoch !== undefined)
      .sort(
        (a, b) =>
          (a.epoch as number) - (b.epoch as number) ||
          a.recordId.localeCompare(b.recordId),
      );
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
   * Adopts the group this device's own pending commit leads to, or
   * applies the commit. `took` tells whether the group took it.
   */
  private async take(
    group: MlsGroup,
    record: MlsRecordResource,
    pending: PendingCommit | undefined,
  ): Promise<{ group: MlsGroup; took: boolean }> {
    if (
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
   * device's key packages opens. The node names the welcome's author; it
   * must hold a leaf in the welcomed group and be allowed to add members,
   * so nobody else can welcome a member into a look-alike group. A removed
   * device only joins an epoch newer than its last membership.
   */
  private async joinFromWelcome(
    groupId: string,
    communityId: string,
    context: { previous?: MlsGroup; roster: CommunityMlsRoster },
  ): Promise<MlsGroup | undefined> {
    const { previous, roster } = context;
    const welcomes = await this.transportFor(communityId).list({
      groupId,
      kind: 'welcome',
    });
    const mine = welcomes.filter(
      (record) =>
        record.recipientIdentityId === this.signer.owner.identityId &&
        roster.manages(record.authorIdentityId),
    );
    const keys = mine.length > 0 ? await this.storedBundles() : [];

    for (const record of mine.sort((a, b) => b.createdAt - a.createdAt)) {
      for (const { bundle, id } of keys) {
        const group = await this.open(groupId, bundle, record);

        if (!group || (previous && group.epoch <= previous.epoch)) continue;
        await this.store.deleteKeyPackage(id);
        await this.remember(group);

        return group;
      }
    }

    return undefined;
  }

  /** The group a welcome opens with the key package, if its author is in it. */
  private async open(
    groupId: string,
    bundle: MlsKeyPackageBundle,
    record: MlsRecordResource,
  ): Promise<MlsGroup | undefined> {
    try {
      const group = await MlsGroup.join(
        groupId,
        bundle,
        fromBase64(record.payload),
        this.policyFor(groupId),
      );

      return group.identities().includes(record.authorIdentityId)
        ? group
        : undefined;
    } catch {
      // Not addressed to this key package.
      return undefined;
    }
  }

  private async makeKeyPackages(
    count: number,
    persist: boolean,
  ): Promise<MlsKeyPackageBundle[]> {
    const bundles: MlsKeyPackageBundle[] = [];

    for (let index = 0; index < count; index += 1) {
      const bundle = await generateMlsKeyPackage(this.signer);

      if (persist) {
        await this.store.saveKeyPackage({
          id: this.idOf(toBase64(bundle.publicBytes)),
          privatePackage: bundle.privatePackage,
          publicBytes: bundle.publicBytes,
        });
      }
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

  /** Reads the roster again; groups judge leaves and commits by the latest. */
  private async currentRoster(groupId: string): Promise<CommunityMlsRoster> {
    const roster = await this.rosterFor(groupId)();

    this.rosters.set(groupId, roster);

    return roster;
  }

  /**
   * Roster members hold leaves; the roster decides who may add and remove
   * them (see `CommunityMlsRoster`).
   */
  private policyFor(groupId: string): MlsMembershipPolicy {
    const roster = (): CommunityMlsRoster =>
      this.rosters.get(groupId) ?? CommunityMlsRoster.empty();

    return {
      admits: (identityId) => roster().has(identityId),
      allows: (change) => roster().allowsCommit(change),
    };
  }

  private async load(groupId: string): Promise<MlsGroup | undefined> {
    const cached = this.groups.get(groupId);

    if (cached) return cached;
    const bytes = await this.store.loadGroup(groupId);

    if (!bytes) return undefined;
    await this.currentRoster(groupId);
    const group = MlsGroup.restore(
      groupId,
      this.signer.owner,
      this.policyFor(groupId),
      bytes,
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
