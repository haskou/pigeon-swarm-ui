import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { decodeMlsMessage } from 'ts-mls';
import {
  CodecError,
  CryptoError,
  CryptoVerificationError,
  InternalError,
  ValidationError,
} from 'ts-mls/mlsError.js';

import type {
  MlsCommitOutcome,
  MlsCommitOutput,
  MlsLeafOwner,
  MlsOpenedMessage,
} from '../../../communities/infrastructure/mls/MlsGroup';
import type { MlsLeafSigner } from '../../../communities/infrastructure/mls/MlsLeafSigner';
import type { MlsMembershipPolicy } from '../../../communities/infrastructure/mls/MlsMembershipPolicy';
import type { MlsStateStore } from '../../../communities/infrastructure/mls/MlsStateStore';
import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
import type { GroupMailboxGenesis } from '../../domain/GroupMailboxGenesis';
import type { GroupMailboxRoster } from '../../domain/GroupMailboxRoster';
import type { GroupMailboxGenerationRepository } from '../../domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxCommit } from './GroupMailboxCommit';
import type { GroupMailboxConfirmation } from './GroupMailboxConfirmation';

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
import { GroupMailboxGenerationLog } from '../../domain/GroupMailboxGenerationLog';
import { GroupMailboxGenerationSecret } from '../../domain/value-objects/GroupMailboxGenerationSecret';
import { GroupMailboxConfirmations } from './GroupMailboxConfirmations';
import { GroupMailboxRosterExtension } from './GroupMailboxRosterExtension';
import { GroupMailboxUnconfirmedError } from './GroupMailboxUnconfirmedError';

const GENERATION_LABEL = 'pigeon/group-mailbox/gen/v1';

/** ts-mls failures that a malformed or forged message causes. */
const MESSAGE_ERRORS = [
  CodecError,
  CryptoError,
  CryptoVerificationError,
  InternalError,
  ValidationError,
];

/**
 * MLS for group conversations on one device. Each conversation is one MLS
 * group; its mailbox generation `gen_k` is exported from the epoch of the
 * last commit, so a removed member cannot derive where the group talks next
 * and a joiner derives the generation itself. All mutation of a group goes
 * through a per-group queue so the ratchet has a single writer; a failed
 * task drops the cached group so the stored state stays the truth. The
 * roster the group's GroupContext carries (`GroupMailboxRosterExtension`)
 * decides who may hold a leaf and who may change membership; only a commit
 * it allows changes it. A commit this device makes is kept only once
 * published. A group joined from someone else's welcome stays unconfirmed
 * until a confirming member speaks in it, and this device sends nothing to
 * it meanwhile: no message, commit or welcome.
 */
export class GroupMailboxMlsEngine {
  private readonly confirmations: GroupMailboxConfirmations;
  private readonly groups = new Map<string, MlsGroup>();
  private readonly queues = new Map<string, Promise<unknown>>();
  /**
   * This identity's devices as its signed transitions last proved them;
   * undefined until fetched, which refuses every commit by this identity.
   */
  private verified: ReadonlySet<string> | undefined;

  /** A rejection for what MLS refused; any other failure as it is. */
  private static rejection(error: unknown): unknown {
    return MESSAGE_ERRORS.some((type) => error instanceof type)
      ? new MlsRejectedError('Message rejected')
      : error;
  }

  /** Where the group a published commit leads to waits until it is saved. */
  private static pendingKey(conversationId: string): string {
    return `${conversationId}#pending`;
  }

  /** The epoch a commit was made in; anything but a commit is rejected. */
  private static epochOf(bytes: Uint8Array): bigint {
    const decoded = decodeMlsMessage(bytes, 0)?.[0];

    if (decoded?.wireformat !== 'mls_private_message') {
      throw new MlsRejectedError('Not an MLS commit');
    }

    return decoded.privateMessage.epoch;
  }

  public constructor(
    private readonly signer: MlsLeafSigner,
    private readonly store: MlsStateStore,
    private readonly generations: GroupMailboxGenerationRepository,
    /** See `GroupConversationPorts.verifiedDevices`. */
    private readonly ownDevices: () => Promise<readonly string[]>,
    /** See `GroupConversationPorts.contacts`. */
    private readonly contacts: () => readonly string[],
    private readonly clock: () => number,
  ) {
    this.confirmations = new GroupMailboxConfirmations(store);
  }

  /**
   * Publishes a commit this device made, then keeps it. The log is written
   * first and the advanced group is set aside as pending; `publish` queues
   * the commit; only then is the group saved. A commit whose publishing
   * fails is abandoned: the stored group stays in its epoch and `load`
   * rewinds the log. A device that stopped after publishing but before
   * saving adopts the pending group when its own commit comes back.
   */
  private async commit(
    group: MlsGroup,
    output: MlsCommitOutput,
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ): Promise<GroupMailboxCommit> {
    const before = group.identities();
    const delivery = await this.generations.load(group.groupId);
    const commitId = this.idOf(output.commit);
    const outcome = group.confirm(commitId);
    const log = await this.follow(group, outcome, delivery, output.epoch);
    const made: GroupMailboxCommit = {
      commit: output.commit,
      deliveryGeneration: delivery.current(),
      epoch: output.epoch,
      generation: log.current(),
      recipients: [...before].sort(),
      ...(output.welcome ? { welcome: output.welcome } : {}),
    };
    const pendingKey = GroupMailboxMlsEngine.pendingKey(group.groupId);

    await this.store.saveGroup(
      pendingKey,
      new TextEncoder().encode(
        JSON.stringify({
          commitId,
          state: encodeBase64Url(group.serialize()),
        } satisfies { commitId: string; state: string }),
      ),
    );

    try {
      await publish(made);
    } catch (error) {
      await this.store
        .saveGroup(pendingKey, new Uint8Array())
        .catch(() => undefined);
      throw error;
    }
    await this.remember(group);
    await this.store
      .saveGroup(pendingKey, new Uint8Array())
      .catch(() => undefined);

    return made;
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

  /**
   * Advances the log when the group is past the epoch it was exported in:
   * every commit moves the generation, a GroupContext-only one included.
   */
  private async caughtUp(
    group: MlsGroup,
    log: GroupMailboxGenerationLog,
  ): Promise<GroupMailboxGenerationLog> {
    if (log.current().epoch >= group.epoch) return log;

    return log.advance(
      await this.exportGeneration(group),
      group.epoch,
      this.treeOf(group),
      this.clock(),
    );
  }

  /**
   * Who confirms a group `inviter` welcomed this device into: the creator
   * its genesis names, and each identity pinned as a contact, other than
   * the inviter and this identity, whose leaf in the welcomed tree one of
   * its own commits or updates wrote. A leaf only ever added carries the
   * key package its adder chose, so no identity the welcome's own commit
   * added confirms; nor does a contact that has not committed yet.
   */
  private confirmersOf(
    group: MlsGroup,
    inviter: string,
    creator: string | undefined,
  ): string[] {
    const self = this.signer.owner.identityId;
    const committed = group.committedIdentities();
    const confirmers = new Set(
      this.contacts().filter(
        (identityId) =>
          identityId !== inviter &&
          identityId !== self &&
          committed.includes(identityId),
      ),
    );

    if (creator !== undefined) confirmers.add(creator);

    return [...confirmers].sort();
  }

  /**
   * What a welcome from `inviter` leaves this device with: confirmed when
   * this identity or the creator the known genesis names sent it, else
   * awaiting one of `confirmersOf`.
   */
  private async welcomedBy(
    conversationId: string,
    group: MlsGroup,
    inviter: string,
  ): Promise<GroupMailboxConfirmation> {
    const creator = (await this.confirmations.genesis(conversationId))
      ?.creatorIdentityId;

    return inviter === this.signer.owner.identityId || inviter === creator
      ? { confirmed: true }
      : {
          confirmed: false,
          confirmers: this.confirmersOf(group, inviter, creator),
        };
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
   * generation is behind whenever the group is past the epoch it was
   * exported in.
   */
  private async follow(
    group: MlsGroup,
    outcome: MlsCommitOutcome,
    log: GroupMailboxGenerationLog,
    commitEpoch: bigint,
  ): Promise<GroupMailboxGenerationLog> {
    if (outcome.kind !== 'applied' && outcome.kind !== 'replaced') return log;
    const next = await this.caughtUp(
      group,
      outcome.kind === 'replaced' ? log.rewind(commitEpoch) : log,
    );

    if (next !== log) await this.generations.save(group.groupId, next);

    return next;
  }

  /**
   * Refuses a welcome from `inviter` unless the welcomed group passes every
   * check against the roster it carries. The roster decodes and every leaf
   * supports it; it is this conversation's, lists this identity and the
   * identity of every leaf, and names the creator a known genesis names.
   * The leaf that signed the welcome must be the inviter's: a member the
   * roster lets add members, or another device of this identity that its
   * signed transitions still authorize, holding a leaf in a group with
   * someone else in it.
   */
  private async checkWelcome(
    group: MlsGroup,
    conversationId: string,
    inviter: string,
  ): Promise<void> {
    const roster = this.welcomedRoster(group, conversationId);
    const genesis = await this.confirmations.genesis(conversationId);

    if (!group.identities().every((identityId) => roster.has(identityId))) {
      throw new MlsRejectedError('Welcome tree holds a non-member');
    }

    if (genesis && genesis.creatorIdentityId !== roster.creatorId) {
      throw new MlsRejectedError('The welcome roster names another creator');
    }

    if (!this.mayWelcome(group, roster, inviter)) {
      throw new MlsRejectedError(
        'The welcome is not from a member who may add devices',
      );
    }
  }

  /**
   * The roster a welcomed group carries, when every leaf supports it, it
   * is this conversation's and it lists this identity.
   */
  private welcomedRoster(
    group: MlsGroup,
    conversationId: string,
  ): GroupMailboxRoster {
    const roster = GroupMailboxRosterExtension.read(group.context());

    if (!roster) throw new MlsRejectedError('The welcome carries no roster');

    if (!group.supports(GroupMailboxRosterExtension.EXTENSION_TYPE)) {
      throw new MlsRejectedError('A welcomed leaf does not support the roster');
    }

    if (roster.conversationId !== conversationId) {
      throw new MlsRejectedError('The welcome is for another conversation');
    }

    if (!roster.has(this.signer.owner.identityId)) {
      throw new MlsRejectedError(
        'The welcome roster does not list this identity',
      );
    }

    return roster;
  }

  /**
   * Whether the inviter's leaf signed the welcome and the inviter is a
   * manager, or another device of this identity its signed transitions
   * authorize, in a group with someone else in it.
   */
  private mayWelcome(
    group: MlsGroup,
    roster: GroupMailboxRoster,
    inviter: string,
  ): boolean {
    const self = this.signer.owner.identityId;
    const welcomer = group.welcomer;

    if (welcomer?.identityId !== inviter) return false;

    if (inviter !== self) return roster.manages(inviter);

    return (
      Boolean(this.verified?.has(welcomer.deviceCredential)) &&
      group.identities().some((identityId) => identityId !== self) &&
      group.leaves().filter(({ owner }) => owner.identityId === self).length > 1
    );
  }

  /**
   * Names bytes (a commit, a key package, a ciphertext) by the lowercase
   * hex SHA-256 of their base64url text. Every member derives a commit's id
   * from the commit bytes alone, never from the node's record id, so all
   * compare the same ids. The committer chooses those bytes and can retry
   * until the id is low: the id only settles rivals the roster ranks alike
   * (`GroupMailboxRoster.priorityOf`), so grinding never beats a higher
   * rank, such as a commit by the creator or one removing the committer.
   */
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
    const group = MlsGroup.restore(
      conversationId,
      this.signer.owner,
      this.policy(),
      bytes,
      [],
    );

    await this.reconcile(group);
    this.groups.set(conversationId, group);

    return group;
  }

  /**
   * The group this device's own commit leads to, if it was kept aside for
   * the epoch the device is still in.
   */
  private async pendingAt(
    group: MlsGroup,
    epoch: bigint,
  ): Promise<{ commitId: string; state: Uint8Array } | undefined> {
    if (epoch !== group.epoch || group.isRemoved) return undefined;
    const bytes = await this.store.loadGroup(
      GroupMailboxMlsEngine.pendingKey(group.groupId),
    );

    if (!bytes?.length) return undefined;
    const { commitId, state } = JSON.parse(new TextDecoder().decode(bytes)) as {
      commitId: string;
      state: string;
    };

    return { commitId, state: new Uint8Array(decodeBase64Url(state)) };
  }

  /**
   * Applies a commit to the group, or adopts the pending group this
   * device's own commit leads to.
   */
  private async process(
    group: MlsGroup,
    bytes: Uint8Array,
  ): Promise<{
    epoch: bigint;
    group: MlsGroup;
    outcome: MlsCommitOutcome;
    pending: boolean;
  }> {
    const epoch = GroupMailboxMlsEngine.epochOf(bytes);
    const id = this.idOf(bytes);
    const pending = await this.pendingAt(group, epoch);

    if (pending?.commitId === id) {
      const adopted = MlsGroup.restore(
        group.groupId,
        this.signer.owner,
        this.policy(),
        pending.state,
        [],
      );

      return {
        epoch,
        group: adopted,
        outcome: { epoch: adopted.epoch, kind: 'applied' },
        pending: true,
      };
    }

    // An old epoch is not processed again; still prove it is ours.
    if (epoch < group.epoch && !group.isRemoved) {
      await group.authenticate(bytes);
    }

    return {
      epoch,
      group,
      outcome: await group.applyCommit({ bytes, epoch, id }),
      pending: pending !== undefined,
    };
  }

  /**
   * A conversation's groups judge every commit by the roster the GroupContext
   * of its epoch carries (`GroupMailboxRoster.allowsCommit`), with the roster
   * its GroupContextExtensions proposal sets, if any; a commit to a context
   * without a roster, or setting anything but one, is refused. They bind no
   * roster revision and none can be withheld. Rivals for an epoch rank by
   * that roster (`GroupMailboxRoster.priorityOf`), then by the lower id.
   * Every identity may hold a leaf as far as MLS is concerned: the roster
   * judges the adds in each commit, and `checkWelcome` every welcome.
   */
  private policy(): MlsMembershipPolicy {
    const self = this.signer.owner.identityId;

    return {
      admits: () => true,
      // Only this identity's own transitions can be verified here: every
      // commit by it must come from a device they still authorize. A
      // peer's device chains to its identity through its credential only.
      allows: (change) => {
        const before = GroupMailboxRosterExtension.read(change.context);
        const next =
          change.proposedContext &&
          GroupMailboxRosterExtension.read(change.proposedContext);

        return (
          before !== undefined &&
          (change.proposedContext === undefined || next !== undefined) &&
          before.allowsCommit(change, next) &&
          (change.committer !== self ||
            Boolean(this.verified?.has(change.committerDevice)))
        );
      },
      frontier: () => [],
      priority: (change) =>
        GroupMailboxRosterExtension.read(change.context)?.priorityOf(change) ??
        0,
      reach: () => 0,
      withheld: () => false,
    };
  }

  /**
   * The devices this identity's signed transitions authorize, before
   * judging a change to the tree. A failed fetch propagates as itself, so
   * the change is tried again later.
   */
  private async refreshPolicy(): Promise<void> {
    this.verified = new Set(await this.ownDevices());
  }

  /**
   * The group the first stored key package opens `welcome` into, with that
   * key package's id; undefined when none of them does.
   */
  private async openWelcome(
    conversationId: string,
    welcome: Uint8Array,
  ): Promise<{ group: MlsGroup; keyPackageId: string } | undefined> {
    for (const stored of await this.store.loadKeyPackages()) {
      try {
        return {
          group: await MlsGroup.join(
            conversationId,
            restoreMlsKeyPackage(stored.publicBytes, stored.privatePackage),
            welcome,
            this.policy(),
          ),
          keyPackageId: stored.id,
        };
      } catch {
        // Not addressed to this key package; try the next one.
      }
    }

    return undefined;
  }

  /**
   * The stored group is the truth. A log saved before a group save that
   * failed holds the generation of a commit nobody received: forget what
   * lies past the group's epoch, then follow its tree.
   */
  private async reconcile(group: MlsGroup): Promise<void> {
    const log = await this.generations.load(group.groupId);

    if (log.isEmpty() || group.isRemoved) return;
    const next = await this.caughtUp(
      group,
      log.current().epoch > group.epoch ? log.rewind(group.epoch) : log,
    );

    if (next !== log) await this.generations.save(group.groupId, next);
  }

  /** The log after reconciling it with the stored group, if there is one. */
  private async reconciledLog(
    conversationId: string,
  ): Promise<GroupMailboxGenerationLog> {
    return this.exclusive(conversationId, async () => {
      await this.load(conversationId);

      return this.generations.load(conversationId);
    });
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

  /**
   * The group, when this device may send to it: nothing leaves a device
   * that holds the group unconfirmed.
   */
  private async requireConfirmed(conversationId: string): Promise<MlsGroup> {
    const group = await this.requireGroup(conversationId);

    if (!(await this.confirmations.of(conversationId)).confirmed) {
      throw new GroupMailboxUnconfirmedError();
    }

    return group;
  }

  /** The roster the group's current GroupContext carries. */
  private static rosterOf(group: MlsGroup): GroupMailboxRoster {
    const roster = GroupMailboxRosterExtension.read(group.context());

    if (!roster) throw new MlsRejectedError('The group carries no roster');

    return roster;
  }

  /**
   * Adds devices by key package; the generation advances. The commit
   * removes no leaf, and the roster refuses it while an identity off the
   * roster holds a leaf (`GroupMailboxRoster.allowsCommit`): such leaves go
   * first, in a removal (`remove`), so nobody dropped learns of the devices
   * added. The commit is kept only once `publish` has queued it.
   */
  public async add(
    conversationId: string,
    keyPackages: Uint8Array[],
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ): Promise<GroupMailboxCommit> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireConfirmed(conversationId);

      await this.refreshPolicy();

      return this.commit(group, await group.add(keyPackages), publish);
    });
  }

  /**
   * Applies a commit another member made, or one this device published but
   * had not saved. Rejects forged and tampered commits, commits the roster
   * does not allow, and ones for an epoch this device already left. A
   * commit that applies is a witness for the group's confirmation.
   */
  public async applyCommit(
    conversationId: string,
    bytes: Uint8Array,
  ): Promise<MlsCommitOutcome> {
    return this.exclusive(conversationId, async () => {
      await this.refreshPolicy();
      const current = await this.requireGroup(conversationId);
      // Sender data only: it counts once the commit's signature verified.
      const committer = await current.authenticate(bytes).then(
        ({ identityId }) => identityId,
        () => undefined,
      );
      const { epoch, group, outcome, pending } = await this.process(
        current,
        bytes,
      ).catch((error: unknown) => {
        throw error instanceof MlsRejectedError
          ? error
          : new MlsRejectedError('Commit rejected');
      });

      await this.follow(
        group,
        outcome,
        await this.generations.load(conversationId),
        epoch,
      );
      await this.remember(group);

      // The epoch moved on: a pending group of this device is void now.
      if (pending) {
        await this.store
          .saveGroup(
            GroupMailboxMlsEngine.pendingKey(conversationId),
            new Uint8Array(),
          )
          .catch(() => undefined);
      }

      if (
        committer !== undefined &&
        (outcome.kind === 'applied' || outcome.kind === 'replaced')
      ) {
        await this.confirmations.witness(conversationId, committer);
      }

      return outcome;
    });
  }

  /**
   * Whether this device holds the group, still in it, but no confirmer has
   * spoken yet; it sends nothing to the group meanwhile.
   */
  public async awaitsConfirmation(conversationId: string): Promise<boolean> {
    return this.exclusive(conversationId, async () => {
      const group = await this.load(conversationId);

      return (
        group !== undefined &&
        !group.isRemoved &&
        !(await this.confirmations.of(conversationId)).confirmed
      );
    });
  }

  /**
   * Commits one roster operation (`GroupMailboxRoster.allowsCommit`): the
   * GroupContext then carries `next`, and every leaf of an identity `next`
   * drops, other than this one's, goes in the same commit. The generation
   * advances. The commit is kept only once `publish` has queued it.
   */
  public async changeRoster(
    conversationId: string,
    next: GroupMailboxRoster,
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ): Promise<GroupMailboxCommit> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireConfirmed(conversationId);
      const self = this.signer.owner.identityId;
      const dropped = GroupMailboxMlsEngine.rosterOf(group)
        .memberIds()
        .filter((identityId) => identityId !== self && !next.has(identityId));

      await this.refreshPolicy();

      return this.commit(
        group,
        await group.changeContext(
          [
            {
              extensionData: GroupMailboxRosterExtension.encode(next),
              extensionType: GroupMailboxRosterExtension.EXTENSION_TYPE,
            },
          ],
          dropped,
        ),
        publish,
      );
    });
  }

  /**
   * Starts the group with this device alone, its GroupContext carrying the
   * roster this identity creates it with, and returns gen_0. A group this
   * device creates is confirmed from the start.
   */
  public async createGroup(
    conversationId: string,
    roster: GroupMailboxRoster,
  ): Promise<GroupMailboxGeneration> {
    if (
      roster.conversationId !== conversationId ||
      roster.creatorId !== this.signer.owner.identityId
    ) {
      throw new MlsRejectedError('The roster is not one this device creates');
    }

    return this.exclusive(conversationId, async () => {
      if (await this.load(conversationId)) {
        throw new MlsRejectedError('Group already exists on this device');
      }
      const group = await MlsGroup.create(
        conversationId,
        await generateMlsKeyPackage(this.signer, [
          GroupMailboxRosterExtension.EXTENSION_TYPE,
        ]),
        this.policy(),
        [
          {
            extensionData: GroupMailboxRosterExtension.encode(roster),
            extensionType: GroupMailboxRosterExtension.EXTENSION_TYPE,
          },
        ],
      );
      const log = (await this.generations.load(conversationId)).start(
        await this.exportGeneration(group),
        group.epoch,
        this.treeOf(group),
      );

      await this.generations.save(conversationId, log);
      await this.confirmations.record(conversationId, { confirmed: true });
      await this.remember(group);

      return log.current();
    });
  }

  /**
   * A single-use key package; its private part stays on this device. It
   * supports the roster extension, so it can join a group carrying one.
   */
  public async createKeyPackage(): Promise<Uint8Array> {
    const bundle = await generateMlsKeyPackage(this.signer, [
      GroupMailboxRosterExtension.EXTENSION_TYPE,
    ]);

    await this.store.saveKeyPackage({
      id: this.idOf(bundle.publicBytes),
      privatePackage: bundle.privatePackage,
      publicBytes: bundle.publicBytes,
    });

    return bundle.publicBytes;
  }

  /**
   * Idempotent: the same ciphertext always yields the stored message. A
   * message MLS does not accept rejects with `MlsRejectedError`; a storage
   * failure, a missing dependency or a misuse rejects with its own error.
   * A message read for the first time is a witness for the group's
   * confirmation.
   */
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
      const opened = await group.open(ciphertext).catch((error: unknown) => {
        throw GroupMailboxMlsEngine.rejection(error);
      });
      const { deviceCredential, identityId } = opened.sender;

      // Once a removal is applied, its leaf's late messages are not read.
      if (
        !group
          .leaves()
          .some(
            ({ owner }) =>
              owner.identityId === identityId &&
              owner.deviceCredential === deviceCredential,
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
      await this.confirmations.witness(conversationId, identityId);

      return opened;
    });
  }

  public async encrypt(
    conversationId: string,
    plaintext: Uint8Array,
  ): Promise<Uint8Array> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireConfirmed(conversationId);
      const ciphertext = await group.encrypt(plaintext);

      // The sender cannot decrypt its own message later; keep it first.
      await this.store.savePlaintext(
        conversationId,
        this.idOf(ciphertext),
        JSON.stringify({
          plaintext: encodeBase64Url(plaintext),
          sender: this.signer.owner,
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
    return (await this.reconciledLog(conversationId)).current();
  }

  /** The genesis this device created the group from or learned for it. */
  public async genesis(
    conversationId: string,
  ): Promise<GroupMailboxGenesis | undefined> {
    return await this.confirmations.genesis(conversationId);
  }

  /**
   * Keeps a genesis, whose creator then confirms a welcome; only its
   * derivation of the conversation id vouches for it.
   */
  public async learnGenesis(genesis: GroupMailboxGenesis): Promise<void> {
    await this.exclusive(genesis.conversationId, () =>
      this.confirmations.learn(genesis),
    );
  }

  /**
   * Joins from a welcome that `inviter`, the peer who sent it, made. Every
   * commit advances the generation, so the joiner exports `gen_k` from the
   * welcome epoch itself; only the public index `k` comes from the inviter.
   * The welcome must pass every check against the roster it carries
   * (`checkWelcome`). A welcome opens once; a removed device can join
   * again from a welcome newer than its last membership. A welcome from
   * this identity or from the creator its genesis names is confirmed at
   * once; any other waits for a confirmer (`confirmersOf`).
   */
  public async join(
    conversationId: string,
    welcome: Uint8Array,
    index: number,
    inviter: string,
  ): Promise<void> {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new MlsRejectedError('The generation index is not valid');
    }
    await this.exclusive(conversationId, async () => {
      const previous = await this.load(conversationId);

      if (previous && !previous.isRemoved) {
        throw new MlsRejectedError('Group already exists on this device');
      }

      if (inviter === this.signer.owner.identityId) await this.refreshPolicy();
      const opened = await this.openWelcome(conversationId, welcome);

      if (!opened) {
        throw new MlsRejectedError('No key package of this device opens it');
      }
      const { group } = opened;

      if (previous && group.epoch <= previous.epoch) {
        throw new MlsRejectedError(
          'The welcome is older than the last membership of this device',
        );
      }
      await this.checkWelcome(group, conversationId, inviter);
      // Before the group itself: a rejoin never keeps an earlier record.
      await this.confirmations.record(
        conversationId,
        await this.welcomedBy(conversationId, group, inviter),
      );
      // The key package goes last: if a save fails, the welcome opens again.
      await this.generations.save(
        conversationId,
        GroupMailboxGenerationLog.empty().start(
          await this.exportGeneration(group),
          group.epoch,
          this.treeOf(group),
          index,
        ),
      );
      await this.remember(group);
      await this.store.deleteKeyPackage(opened.keyPackageId);
    });
  }

  /**
   * The device credentials of this identity's leaves, this device's own
   * included; empty when this device holds no leaf in the group.
   */
  public async devices(conversationId: string): Promise<string[]> {
    return this.exclusive(conversationId, async () => {
      const group = await this.load(conversationId);

      if (!group || group.isRemoved) return [];

      return group
        .leaves()
        .filter(
          ({ owner }) => owner.identityId === this.signer.owner.identityId,
        )
        .map(({ owner }) => owner.deviceCredential)
        .sort();
    });
  }

  /** Sorted identities holding a leaf in the group. */
  public async members(conversationId: string): Promise<string[]> {
    return this.exclusive(conversationId, async () =>
      (await this.requireGroup(conversationId)).identities().sort(),
    );
  }

  /**
   * The roster this device's group for the conversation carries; undefined
   * when it holds no group, was removed from it, or the group carries none.
   */
  public async roster(
    conversationId: string,
  ): Promise<GroupMailboxRoster | undefined> {
    return this.exclusive(conversationId, async () => {
      const group = await this.load(conversationId);

      return group && !group.isRemoved
        ? GroupMailboxRosterExtension.read(group.context())
        : undefined;
    });
  }

  /** Retired generations whose drain window has closed. */
  public async drainedGenerations(
    conversationId: string,
  ): Promise<GroupMailboxGeneration[]> {
    return (await this.reconciledLog(conversationId)).drained(this.clock());
  }

  /** The current generation first, then any retired one still drained. */
  public async readableGenerations(
    conversationId: string,
  ): Promise<GroupMailboxGeneration[]> {
    return (await this.reconciledLog(conversationId)).readable(this.clock());
  }

  /**
   * Removes every device of the given identities, which the roster must no
   * longer list, and advances the generation; undefined when none of them
   * holds a leaf. The commit is kept only once `publish` has queued it.
   */
  public async remove(
    conversationId: string,
    identityIds: string[],
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ): Promise<GroupMailboxCommit | undefined> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireConfirmed(conversationId);

      await this.refreshPolicy();
      const output = await group.removeIdentities(identityIds);

      return output ? this.commit(group, output, publish) : undefined;
    });
  }

  /**
   * Removes the leaves of these devices of this identity and advances the
   * generation; undefined when none of them holds a leaf. The commit is
   * kept only once `publish` has queued it.
   */
  public async removeDevices(
    conversationId: string,
    deviceCredentials: string[],
    publish: (commit: GroupMailboxCommit) => Promise<void>,
  ): Promise<GroupMailboxCommit | undefined> {
    return this.exclusive(conversationId, async () => {
      const group = await this.requireConfirmed(conversationId);

      await this.refreshPolicy();
      const output = await group.removeDevices(
        this.signer.owner.identityId,
        deviceCredentials,
      );

      return output ? this.commit(group, output, publish) : undefined;
    });
  }
}
