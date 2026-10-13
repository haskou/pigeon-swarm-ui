import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { decodeMlsMessage } from 'ts-mls';

import type {
  MlsCommitOutcome,
  MlsCommitOutput,
  MlsLeafOwner,
  MlsOpenedMessage,
} from '../../../communities/infrastructure/mls/MlsGroup';
import type { MlsStateStore } from '../../../communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
import type { GroupMailboxGenerationLog } from '../../domain/GroupMailboxGenerationLog';
import type { GroupMailboxGenerationRepository } from '../../domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxCommit } from './GroupMailboxCommit';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import {
  generateMlsKeyPackage,
  MlsGroup,
  restoreMlsKeyPackage,
} from '../../../communities/infrastructure/mls/MlsGroup';
import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';
import { GroupMailboxGenerationSecret } from '../../domain/value-objects/GroupMailboxGenerationSecret';

const GENERATION_LABEL = 'pigeon/group-mailbox/gen/v1';

/**
 * MLS for group conversations on one device. Each conversation is one MLS
 * group; its mailbox generation `gen_k` is exported from the epoch of the
 * last membership change, so a removed member cannot derive where the group
 * talks next and a joiner derives the generation itself. All mutation of a
 * group goes through a per-group queue so the ratchet has a single writer;
 * a failed task drops the cached group so the stored state stays the truth.
 */
export class GroupMailboxMlsEngine {
  private readonly groups = new Map<string, MlsGroup>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly rosters = new Map<string, ReadonlySet<string>>();

  public constructor(
    private readonly owner: MlsLeafOwner,
    private readonly store: MlsStateStore,
    private readonly generations: GroupMailboxGenerationRepository,
    private readonly rosterFor: (
      conversationId: string,
    ) => Promise<ReadonlySet<string>>,
    private readonly clock: () => number,
  ) {}

  /**
   * Confirms a commit this device made, then advances the generation if the
   * tree changed. The log is written first: reapplying is idempotent.
   */
  private async commit(
    group: MlsGroup,
    output: MlsCommitOutput,
  ): Promise<GroupMailboxCommit> {
    const delivery = await this.generations.load(group.groupId);
    const outcome = group.confirm(this.idOf(output.commit));
    const log = await this.follow(group, outcome, delivery, output.epoch);

    await this.remember(group);

    return {
      commit: output.commit,
      deliveryGeneration: delivery.current(),
      epoch: output.epoch,
      generation: log.current(),
      ...(output.welcome ? { welcome: output.welcome } : {}),
    };
  }

  private async exclusive<T>(
    conversationId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.queues.get(conversationId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .catch((error: unknown) => {
        this.groups.delete(conversationId);
        throw error;
      });

    this.queues.set(conversationId, next);

    return next;
  }

  private async exportGeneration(
    group: MlsGroup,
  ): Promise<GroupMailboxGenerationSecret> {
    return GroupMailboxGenerationSecret.fromBytes(
      await group.exportSecret(GENERATION_LABEL, new Uint8Array()),
    );
  }

  /**
   * Moves the log along with an applied commit; saves it if it changed. The
   * generation is behind whenever the tree differs from the one it was
   * exported for, whatever the last commit was.
   */
  private async follow(
    group: MlsGroup,
    outcome: MlsCommitOutcome,
    log: GroupMailboxGenerationLog,
    commitEpoch: bigint,
  ): Promise<GroupMailboxGenerationLog> {
    if (outcome.kind !== 'applied' && outcome.kind !== 'replaced') return log;
    let next = outcome.kind === 'replaced' ? log.rewind(commitEpoch) : log;
    const tree = this.treeOf(group);

    if (next.current().tree !== tree && next.current().epoch < group.epoch) {
      next = next.advance(
        await this.exportGeneration(group),
        group.epoch,
        tree,
        this.clock(),
      );
    }

    if (next !== log) await this.generations.save(group.groupId, next);

    return next;
  }

  private idOf(bytes: Uint8Array): string {
    return SHA256Hash.from(encodeBase64Url(bytes)).toString();
  }

  /** Digest of the leaves (position and signature key) of the current tree. */
  private treeOf(group: MlsGroup): string {
    return SHA256Hash.from(
      group
        .leaves()
        .map(
          ({ index, signaturePublicKey }) =>
            `${index}:${encodeBase64Url(signaturePublicKey)}`,
        )
        .sort()
        .join(','),
    ).toString();
  }

  private async load(conversationId: string): Promise<MlsGroup | undefined> {
    const cached = this.groups.get(conversationId);

    if (cached) return cached;
    const bytes = await this.store.loadGroup(conversationId);

    if (!bytes) return undefined;
    await this.refreshRoster(conversationId);
    const group = MlsGroup.restore(
      conversationId,
      this.owner,
      this.policyFor(conversationId),
      bytes,
    );

    this.groups.set(conversationId, group);

    return group;
  }

  private policyFor(conversationId: string): (identityId: string) => boolean {
    return (identityId) =>
      this.rosters.get(conversationId)?.has(identityId) ?? false;
  }

  /** Groups judge credentials against the latest conversation roster. */
  private async refreshRoster(conversationId: string): Promise<void> {
    this.rosters.set(conversationId, await this.rosterFor(conversationId));
  }

  private async remember(group: MlsGroup): Promise<void> {
    this.groups.set(group.groupId, group);
    await this.store.saveGroup(group.groupId, group.serialize());
  }

  private async requireGroup(conversationId: string): Promise<MlsGroup> {
    const group = await this.load(conversationId);

    if (!group) throw new MlsRejectedError('This device is not in the group');

    return group;
  }

  /** Adds devices by key package. Adds never rotate the generation. */
  public async add(
    conversationId: string,
    keyPackages: Uint8Array[],
  ): Promise<GroupMailboxCommit> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireGroup(conversationId);

      await this.refreshRoster(conversationId);

      return this.commit(group, await group.add(keyPackages));
    });
  }

  /**
   * Applies a commit another member made. Rejects forged and tampered
   * commits, including ones for an epoch this device already left.
   */
  public async applyCommit(
    conversationId: string,
    bytes: Uint8Array,
  ): Promise<MlsCommitOutcome> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireGroup(conversationId);
      let outcome: MlsCommitOutcome;
      let epoch: bigint;

      await this.refreshRoster(conversationId);

      try {
        const decoded = decodeMlsMessage(bytes, 0)?.[0];

        if (decoded?.wireformat !== 'mls_private_message') {
          throw new MlsRejectedError('Not an MLS commit');
        }
        epoch = decoded.privateMessage.epoch;

        // An old epoch is not processed again; still prove it is ours.
        if (epoch < group.epoch && !group.isRemoved) {
          await group.authenticate(bytes);
        }
        outcome = await group.applyCommit({
          bytes,
          epoch,
          id: this.idOf(bytes),
        });
      } catch (error) {
        throw error instanceof MlsRejectedError
          ? error
          : new MlsRejectedError('Commit rejected');
      }
      await this.follow(
        group,
        outcome,
        await this.generations.load(conversationId),
        epoch,
      );
      await this.remember(group);

      return outcome;
    });
  }

  /** Starts the group with this device alone and returns gen_0. */
  public async createGroup(
    conversationId: string,
  ): Promise<GroupMailboxGeneration> {
    return this.exclusive(conversationId, async () => {
      if (await this.load(conversationId)) {
        throw new MlsRejectedError('Group already exists on this device');
      }
      await this.refreshRoster(conversationId);
      const group = await MlsGroup.create(
        conversationId,
        await generateMlsKeyPackage(this.owner),
        this.policyFor(conversationId),
      );
      const log = (await this.generations.load(conversationId)).start(
        await this.exportGeneration(group),
        group.epoch,
        this.treeOf(group),
      );

      await this.generations.save(conversationId, log);
      await this.remember(group);

      return log.current();
    });
  }

  /** A single-use key package; its private part stays on this device. */
  public async createKeyPackage(): Promise<Uint8Array> {
    const bundle = await generateMlsKeyPackage(this.owner);

    await this.store.saveKeyPackage({
      id: this.idOf(bundle.publicBytes),
      privatePackage: bundle.privatePackage,
      publicBytes: bundle.publicBytes,
    });

    return bundle.publicBytes;
  }

  /** Idempotent: the same ciphertext always yields the stored message. */
  public async decrypt(
    conversationId: string,
    ciphertext: Uint8Array,
  ): Promise<MlsOpenedMessage> {
    return this.exclusive(conversationId, async () => {
      const id = this.idOf(ciphertext);
      const cached = await this.store.loadPlaintext(conversationId, id);

      if (cached !== undefined) {
        const message = JSON.parse(cached) as {
          plaintext: string;
          sender: MlsLeafOwner;
        };

        return {
          plaintext: new Uint8Array(decodeBase64Url(message.plaintext)),
          sender: message.sender,
        };
      }
      const group = await this.requireGroup(conversationId);
      const opened = await group.open(ciphertext);
      const { deviceId, identityId } = opened.sender;

      // Once a removal is applied, its leaf's late messages are not read.
      if (
        !group
          .leaves()
          .some(
            ({ owner }) =>
              owner.identityId === identityId && owner.deviceId === deviceId,
          )
      ) {
        throw new MlsRejectedError('The sender is no longer in the group');
      }

      // Persist the message before the advanced ratchet: losing the state
      // is recoverable; a message that cannot be decrypted again is not.
      await this.store.savePlaintext(
        conversationId,
        id,
        JSON.stringify({
          plaintext: encodeBase64Url(opened.plaintext),
          sender: opened.sender,
        } satisfies { plaintext: string; sender: MlsLeafOwner }),
      );
      await this.remember(group);

      return opened;
    });
  }

  public async encrypt(
    conversationId: string,
    plaintext: Uint8Array,
  ): Promise<Uint8Array> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireGroup(conversationId);
      const ciphertext = await group.encrypt(plaintext);

      // The sender cannot decrypt its own message later; keep it first.
      await this.store.savePlaintext(
        conversationId,
        this.idOf(ciphertext),
        JSON.stringify({
          plaintext: encodeBase64Url(plaintext),
          sender: this.owner,
        } satisfies { plaintext: string; sender: MlsLeafOwner }),
      );
      await this.remember(group);

      return ciphertext;
    });
  }

  /** The generation the group sends to now. */
  public async generation(
    conversationId: string,
  ): Promise<GroupMailboxGeneration> {
    return (await this.generations.load(conversationId)).current();
  }

  /**
   * Joins from a welcome. Every add advances the generation, so the joiner
   * exports `gen_k` from the welcome epoch itself; only the public index
   * `k` comes from the inviter. A welcome opens once.
   */
  public async join(
    conversationId: string,
    welcome: Uint8Array,
    index: number,
  ): Promise<void> {
    await this.exclusive(conversationId, async () => {
      if (await this.load(conversationId)) {
        throw new MlsRejectedError('Group already exists on this device');
      }
      await this.refreshRoster(conversationId);

      for (const stored of await this.store.loadKeyPackages()) {
        let group: MlsGroup;

        try {
          group = await MlsGroup.join(
            conversationId,
            restoreMlsKeyPackage(stored.publicBytes, stored.privatePackage),
            welcome,
            this.policyFor(conversationId),
          );
        } catch {
          // Not addressed to this key package; try the next one.
          continue;
        }

        await this.store.deleteKeyPackage(stored.id);
        await this.generations.save(
          conversationId,
          (await this.generations.load(conversationId)).start(
            await this.exportGeneration(group),
            group.epoch,
            this.treeOf(group),
            index,
          ),
        );
        await this.remember(group);

        return;
      }

      throw new MlsRejectedError('No key package of this device opens it');
    });
  }

  /** Sorted identities holding a leaf in the group. */
  public async members(conversationId: string): Promise<string[]> {
    return this.exclusive(conversationId, async () =>
      (await this.requireGroup(conversationId)).identities().sort(),
    );
  }

  /** The current generation first, then any retired one still drained. */
  public async readableGenerations(
    conversationId: string,
  ): Promise<GroupMailboxGeneration[]> {
    return (await this.generations.load(conversationId)).readable(this.clock());
  }

  /**
   * Removes every device of the given identities and advances the
   * generation; undefined when none of them holds a leaf.
   */
  public async remove(
    conversationId: string,
    identityIds: string[],
  ): Promise<GroupMailboxCommit | undefined> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireGroup(conversationId);
      const output = await group.removeIdentities(identityIds);

      return output ? this.commit(group, output) : undefined;
    });
  }
}
