import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { MlsRecordResource } from '../http/resources/MlsRecordResource';
import type { MlsKeyPackageBundle, MlsLeafOwner } from './MlsGroup';
import type { MlsRecordTransport } from './MlsRecordTransport';
import type { MlsRoster } from './MlsRoster';
import type { MlsStateStore } from './MlsStateStore';

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

const pickNewestPerDevice = (
  published: MlsRecordResource[],
  wanted: ReadonlySet<string>,
  present: ReadonlySet<string>,
): Map<string, MlsRecordResource> => {
  const chosen = new Map<string, MlsRecordResource>();

  for (const record of published) {
    if (!wanted.has(record.authorIdentityId)) continue;
    const owner = mlsKeyPackageOwner(fromBase64(record.payload));
    const device = `${owner.identityId}/${owner.deviceId}`;
    const known = chosen.get(device);

    if (owner.identityId !== record.authorIdentityId) continue;

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

  public constructor(
    private readonly owner: MlsLeafOwner,
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
      const roster = await this.rosterFor(groupId)();
      const [key] = await this.makeKeyPackages(1, false);
      const group = await MlsGroup.create(groupId, key, (id) => roster.has(id));

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
   * state, then applies commits in order. Returns false once this device has
   * been removed.
   */
  public async sync(groupId: string): Promise<boolean> {
    return this.exclusive(groupId, async () => {
      const communityId = this.communityOf(groupId);
      let group = await this.load(groupId);

      if (!group) group = await this.joinFromWelcome(groupId, communityId);

      if (!group) return true;

      if (group.isRemoved) return false;

      const current = Number(group.epoch);
      const records = await this.transportFor(communityId).list({
        ...(current >= 2 && { afterEpoch: current - 2 }),
        groupId,
        kind: 'commit',
      });
      const ordered = records
        .filter((record) => record.epoch !== undefined)
        .sort(
          (a, b) =>
            (a.epoch as number) - (b.epoch as number) ||
            a.recordId.localeCompare(b.recordId),
        );

      for (const record of ordered) {
        if (group.isRemoved) break;
        await group.applyCommit({
          bytes: fromBase64(record.payload),
          epoch: BigInt(record.epoch as number),
          id: record.recordId,
        });
      }
      await this.remember(group);

      return !group.isRemoved;
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
      const commit = await this.publishCommit(transport, groupId, output);

      group.confirm(commit.recordId);

      if (output.welcome) {
        const recipients = new Set(
          [...chosen.values()].map((record) => record.authorIdentityId),
        );

        for (const recipientIdentityId of recipients) {
          await transport.publish({
            epoch: Number(output.epoch),
            groupId,
            kind: 'welcome',
            payload: toBase64(output.welcome),
            recipientIdentityId,
          });
        }
      }
      await this.remember(group);
    });
  }

  /** Removes every leaf of the identities. No-op when none are present. */
  public async remove(groupId: string, identityIds: string[]): Promise<void> {
    await this.exclusive(groupId, async () => {
      const group = await this.requireGroup(groupId);
      const output = await group.removeIdentities(identityIds);

      if (!output) return;
      const commit = await this.publishCommit(
        this.transportFor(this.communityOf(groupId)),
        groupId,
        output,
      );

      group.confirm(commit.recordId);
      await this.remember(group);
    });
  }

  /**
   * Makes the group follow the signed roster: removes leaves whose identity
   * left, was kicked or banned, and admits roster members that published a key
   * package. Safe to run on every member; duplicates resolve by commit id.
   * Returns false once this device is no longer in the group.
   */
  public async reconcile(groupId: string): Promise<boolean> {
    if (!(await this.sync(groupId))) return false;

    if (!(await this.hasGroup(groupId))) return true;

    const roster = await this.rosterFor(groupId)();
    const inGroup = await this.identities(groupId);
    const stale = inGroup.filter((identity) => !roster.has(identity));

    if (stale.length > 0) await this.remove(groupId, stale);
    const missing = [...roster].filter(
      (identity) => !inGroup.includes(identity),
    );

    if (missing.length > 0) await this.admit(groupId, missing);

    return this.sync(groupId);
  }

  /** Identities holding a leaf. */
  public async identities(groupId: string): Promise<string[]> {
    return this.exclusive(groupId, async () =>
      (await this.requireGroup(groupId)).identities(),
    );
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

  private async publishCommit(
    transport: MlsRecordTransport,
    groupId: string,
    output: { commit: Uint8Array; epoch: bigint },
  ): Promise<MlsRecordResource> {
    const input = {
      epoch: Number(output.epoch),
      groupId,
      kind: 'commit' as const,
      payload: toBase64(output.commit),
    };
    const record = await transport.publish(input);

    if (record.recordId !== deriveMlsRecordId(input)) {
      throw new MlsRejectedError('Node returned a different record id');
    }

    return record;
  }

  private async joinFromWelcome(
    groupId: string,
    communityId: string,
  ): Promise<MlsGroup | undefined> {
    const welcomes = await this.transportFor(communityId).list({
      groupId,
      kind: 'welcome',
    });
    const mine = welcomes.filter(
      (record) => record.recipientIdentityId === this.owner.identityId,
    );

    if (mine.length === 0) return undefined;
    const roster = await this.rosterFor(groupId)();
    const keys = await this.storedBundles();

    for (const record of mine.sort((a, b) => b.createdAt - a.createdAt)) {
      for (const { bundle, id } of keys) {
        try {
          const group = await MlsGroup.join(
            groupId,
            bundle,
            fromBase64(record.payload),
            (identity) => roster.has(identity),
          );

          await this.store.deleteKeyPackage(id);
          await this.remember(group);

          return group;
        } catch {
          // Not addressed to this key package; try the next one.
        }
      }
    }

    return undefined;
  }

  private async makeKeyPackages(
    count: number,
    persist: boolean,
  ): Promise<MlsKeyPackageBundle[]> {
    const bundles: MlsKeyPackageBundle[] = [];

    for (let index = 0; index < count; index += 1) {
      const bundle = await generateMlsKeyPackage(this.owner);

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

  private async load(groupId: string): Promise<MlsGroup | undefined> {
    const cached = this.groups.get(groupId);

    if (cached) return cached;
    const bytes = await this.store.loadGroup(groupId);

    if (!bytes) return undefined;
    const roster = await this.rosterFor(groupId)();
    const group = MlsGroup.restore(
      groupId,
      this.owner,
      (id) => roster.has(id),
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
