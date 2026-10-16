import type { MlsLeafOwner } from '../../../communities/infrastructure/mls/MlsGroup';
import type { GroupMailboxRoster } from '../../domain/GroupMailboxRoster';
import type { GroupMailboxCommit } from '../mls/GroupMailboxCommit';
import type { GroupMailboxOutbox } from '../outbox/GroupMailboxOutbox';
import type { GroupMailboxControlEngine } from './GroupMailboxControlEngine';
import type { GroupMailboxControlFields } from './GroupMailboxControlFields';
import type { GroupMailboxControlOutcome } from './GroupMailboxControlOutcome';
import type { GroupMailboxDirectLink } from './GroupMailboxDirectLink';
import type { PendingGroupMailboxKeyPackage } from './PendingGroupMailboxKeyPackage';

import { mlsKeyPackageOwner } from '../../../communities/infrastructure/mls/MlsGroup';
import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { GroupMailboxUnconfirmedError } from '../mls/GroupMailboxUnconfirmedError';
import { GroupMailboxControlRecord } from './GroupMailboxControlRecord';
import { GroupMailboxKeyPackageTimeoutError } from './GroupMailboxKeyPackageTimeoutError';

/**
 * Control traffic of a group conversation (node
 * `docs/design/group-mailboxes.md`, D8). The group's roster travels in its
 * GroupContext (`GroupMailboxRosterExtension`) and changes only by a roster
 * commit (`changeRoster`), which every member judges by the roster of the
 * epoch it applies to. A manager asks each member that holds no leaf yet for
 * a key package, in a letter signed by its identity key and sealed to that
 * member (`GroupMailboxNotificationLink`), at most once per session. The
 * answer goes to the manager's identity; only the device and session that
 * sent the request take it, once, and commit the add, kept only once the
 * durable outbox has queued it for every existing member's inbox of the
 * generation the commit was made in, and hand the joiner `{welcome, k}` in
 * another letter. The key package's credential must be signed by the member's
 * identity key. A removal is delivered through the outbox to the remaining
 * members only. A welcome is judged by the engine against the roster it
 * carries. Logs never carry key material, welcomes or commits.
 *
 * A key-package request from a contact is answered at once. One from any
 * other identity is `deferred`: it is answered only once the user accepts
 * it as a group invitation (`receiveDirect` with `consented`).
 *
 * A device also adds and removes the other devices of its own identity:
 * it sends its identity a key-package request naming one device, which
 * only that device answers, and only while it holds no leaf; the answer's
 * key package must be that device's, and only the asking device takes it.
 *
 * Each welcome names the device whose key package it used and goes to that
 * device's identity; the identity's other devices leave it. A record that is
 * not for this device or session is `ignored`; one this device refuses for
 * its whole identity is `rejected`.
 *
 * Each key-package request carries the group's genesis when its sender
 * knows it, so a joiner learns the creator before any welcome and a
 * welcome from the creator confirms the group at once. A device that
 * awaits the group's confirmation neither asks for nor hands out key
 * packages for it, and commits nothing.
 */
export class GroupMailboxControl {
  public static readonly KEY_PACKAGE_TIMEOUT_MS = 60_000;

  /** The members asked for a key package this session, per conversation. */
  private readonly asked = new Set<string>();
  /** The member (`asked` key) each unanswered request of this session asked. */
  private readonly awaited = new Map<string, string>();
  private readonly pending = new Map<string, PendingGroupMailboxKeyPackage>();

  /** The owner a key package's credential names, if it decodes. */
  private static ownerOf(keyPackage: Uint8Array): MlsLeafOwner | undefined {
    try {
      return mlsKeyPackageOwner(keyPackage);
    } catch {
      return undefined;
    }
  }

  public constructor(
    private readonly self: MlsLeafOwner,
    private readonly engine: GroupMailboxControlEngine,
    /** See `GroupConversationPorts.contacts`. */
    private readonly contacts: () => readonly string[],
    private readonly direct: GroupMailboxDirectLink,
    private readonly outbox: Pick<
      GroupMailboxOutbox,
      'enqueueCommit' | 'flush'
    >,
  ) {}

  /**
   * Commits `next` as the group's roster; the leaves of a member it drops
   * are removed in the same commit, which reaches every member that held a
   * leaf before it (`GroupMailboxCommit.recipients`).
   */
  private async changeRoster(
    conversationId: string,
    next: GroupMailboxRoster | undefined,
  ): Promise<GroupMailboxCommit> {
    if (!next) throw new MlsRejectedError('The roster does not allow it');
    const commit = await this.engine.changeRoster(
      conversationId,
      next,
      (made) => this.outbox.enqueueCommit(conversationId, made),
    );

    await this.outbox.flush();

    return commit;
  }

  /** The group's current roster; rejects when this device holds none. */
  private async current(conversationId: string): Promise<GroupMailboxRoster> {
    const roster = await this.engine.roster(conversationId);

    if (!roster)
      throw new MlsRejectedError('This identity is not in the group');

    return roster;
  }

  /**
   * Keeps the genesis a key-package request carries. While this device
   * awaits the group's confirmation the request is not answered: rejected
   * when it names this device, else ignored.
   */
  private async heldBack(
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
  ): Promise<GroupMailboxControlOutcome | undefined> {
    if (record.genesis) await this.engine.learnGenesis(record.genesis);

    if (!(await this.engine.awaitsConfirmation(record.conversationId))) {
      return undefined;
    }

    return record.deviceCredential === this.self.deviceCredential
      ? 'rejected'
      : 'ignored';
  }

  /**
   * Why a key-package request goes unanswered, if it does: ignored when it
   * asks another device; rejected from another device of this identity that
   * names no device, or by one while this device already holds a leaf, and
   * from another identity when it names a device; deferred from an identity
   * that is not a contact, unless the user `consented`; else as `heldBack`
   * decides.
   */
  private async refusal(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
    consented: boolean,
  ): Promise<GroupMailboxControlOutcome | undefined> {
    const sibling = peerIdentityId === this.self.identityId;
    const misaddressed = await this.misaddressed(sibling, record);

    if (misaddressed) return misaddressed;

    if (!sibling && !consented && !this.contacts().includes(peerIdentityId)) {
      return 'deferred';
    }

    return this.heldBack(record);
  }

  /**
   * Ignored when the request asks another device; rejected when a sibling
   * names no device or already holds a leaf, or another identity names one.
   */
  private async misaddressed(
    sibling: boolean,
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
  ): Promise<GroupMailboxControlOutcome | undefined> {
    const { conversationId, deviceCredential } = record;

    if (
      deviceCredential !== undefined &&
      deviceCredential !== this.self.deviceCredential
    ) {
      return 'ignored';
    }

    if (
      sibling !== (deviceCredential !== undefined) ||
      (sibling && (await this.engine.devices(conversationId)).length > 0)
    ) {
      return 'rejected';
    }

    return undefined;
  }

  /**
   * Answers a contact, an identity the user accepted the request of, or
   * another device of this identity that asks this very device while it
   * holds no leaf in the group. Keeps the genesis the request carries. A
   * device awaiting the group's confirmation answers nobody.
   */
  private async receiveKeyPackageRequest(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
    consented: boolean,
  ): Promise<GroupMailboxControlOutcome> {
    const { conversationId, requestId } = record;
    const refused = await this.refusal(peerIdentityId, record, consented);

    if (refused) return refused;

    await this.direct.send(
      conversationId,
      peerIdentityId,
      GroupMailboxControlRecord.encode({
        conversationId,
        keyPackage: await this.engine.createKeyPackage(),
        requestId,
        type: 'key-package-response',
      }),
    );

    return 'applied';
  }

  /**
   * An answer from another identity counts only on the device and session
   * that asked it, for that conversation, and once; any other device or
   * session of this identity ignores it, so a sibling that never reads it,
   * or whose roster read lags, cannot hold the add back. The request is
   * taken before anything else awaits, so concurrent copies of the answer
   * count once, and given back when the add throws, so the letter's retry
   * counts. The asker commits the add while this identity may add members,
   * the roster lists that identity and it holds no leaf yet, from that
   * identity's key package.
   */
  private async receiveMemberKeyPackage(
    peerIdentityId: string,
    record: Extract<
      GroupMailboxControlFields,
      { type: 'key-package-response' }
    >,
  ): Promise<GroupMailboxControlOutcome> {
    const { conversationId, keyPackage, requestId } = record;
    const key = JSON.stringify([conversationId, peerIdentityId]);

    if (
      (await this.engine.awaitsConfirmation(conversationId)) ||
      this.awaited.get(requestId) !== key
    ) {
      return 'ignored';
    }
    this.awaited.delete(requestId);

    try {
      const roster = await this.engine.roster(conversationId);

      if (
        !roster?.manages(this.self.identityId) ||
        !roster.has(peerIdentityId) ||
        GroupMailboxControl.ownerOf(keyPackage)?.identityId !==
          peerIdentityId ||
        (await this.engine.members(conversationId)).includes(peerIdentityId)
      ) {
        return 'rejected';
      }

      return await this.rejecting(() =>
        this.welcome(conversationId, [keyPackage]),
      );
    } catch (error: unknown) {
      this.awaited.set(requestId, key);
      throw error;
    }
  }

  /**
   * An answer from another device of this identity counts only on the
   * device that asked it, and its key package must be the asked device's.
   */
  private receiveDeviceKeyPackage(
    conversationId: string,
    requestId: string,
    keyPackage: Uint8Array,
  ): GroupMailboxControlOutcome {
    const waiting = this.pending.get(requestId);

    if (waiting?.conversationId !== conversationId) return 'ignored';
    this.pending.delete(requestId);
    clearTimeout(waiting.timer);
    const owner = GroupMailboxControl.ownerOf(keyPackage);

    if (
      owner?.identityId !== this.self.identityId ||
      owner.deviceCredential !== waiting.deviceCredential
    ) {
      // eslint-disable-next-line no-console
      console.debug('Group mailbox control record rejected.');
      waiting.reject(
        new MlsRejectedError('Key package does not belong to the device'),
      );

      return 'rejected';
    }
    waiting.resolve(keyPackage);

    return 'applied';
  }

  /**
   * Joins from a welcome naming this device; the engine judges it against
   * the roster it carries.
   */
  private async receiveWelcome(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'welcome' }>,
  ): Promise<GroupMailboxControlOutcome> {
    if (record.deviceCredential !== this.self.deviceCredential) {
      return 'ignored';
    }

    return this.rejecting(() =>
      this.engine.join(
        record.conversationId,
        record.welcome,
        record.index,
        peerIdentityId,
      ),
    );
  }

  /** `MlsRejectedError` becomes `rejected`; any other failure propagates. */
  private async rejecting(
    operation: () => Promise<unknown>,
  ): Promise<GroupMailboxControlOutcome> {
    try {
      await operation();

      return 'applied';
    } catch (error: unknown) {
      if (!(error instanceof MlsRejectedError)) throw error;
      // eslint-disable-next-line no-console
      console.debug('Group mailbox control record rejected.');

      return 'rejected';
    }
  }

  /** Asks `peerIdentityId` for a key package, naming `deviceCredential`. */
  private async request(
    conversationId: string,
    peerIdentityId: string,
    requestId: string,
    deviceCredential?: string,
  ): Promise<void> {
    if (await this.engine.awaitsConfirmation(conversationId)) {
      throw new GroupMailboxUnconfirmedError();
    }
    const genesis = await this.engine.genesis(conversationId);

    await this.direct.send(
      conversationId,
      peerIdentityId,
      GroupMailboxControlRecord.encode({
        conversationId,
        ...(deviceCredential === undefined ? {} : { deviceCredential }),
        ...(genesis === undefined ? {} : { genesis }),
        requestId,
        type: 'key-package-request',
      }),
    );
  }

  /**
   * Asks one other device of this identity for a key package, handing on
   * the group's genesis when this device knows it. Rejects while this
   * device awaits the group's confirmation.
   */
  private async requestDeviceKeyPackage(
    conversationId: string,
    deviceCredential: string,
  ): Promise<Uint8Array> {
    const requestId = MailboxChannel.randomEnvelopeId();
    const answer = new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(requestId, {
        conversationId,
        deviceCredential,
        reject,
        resolve,
        timer: setTimeout(() => {
          this.pending.delete(requestId);
          reject(new GroupMailboxKeyPackageTimeoutError());
        }, GroupMailboxControl.KEY_PACKAGE_TIMEOUT_MS),
      });
    });

    try {
      await this.request(
        conversationId,
        this.self.identityId,
        requestId,
        deviceCredential,
      );
    } catch (error: unknown) {
      const waiting = this.pending.get(requestId);

      this.pending.delete(requestId);

      if (waiting) clearTimeout(waiting.timer);
      throw error;
    }

    return answer;
  }

  /**
   * Commits the key packages, then hands `{welcome, k}` to the device of
   * each, in a letter to its identity that names it. The commit reaches
   * every existing member first. Every key package was checked to be its
   * requested owner's when it arrived.
   */
  private async welcome(
    conversationId: string,
    keyPackages: Uint8Array[],
  ): Promise<GroupMailboxCommit> {
    const commit = await this.engine.add(conversationId, keyPackages, (made) =>
      this.outbox.enqueueCommit(conversationId, made),
    );

    await this.outbox.flush();
    const { welcome } = commit;

    if (welcome) {
      await Promise.all(
        keyPackages.map((keyPackage) => {
          const { deviceCredential, identityId } =
            mlsKeyPackageOwner(keyPackage);

          return this.direct.send(
            conversationId,
            identityId,
            GroupMailboxControlRecord.encode({
              conversationId,
              deviceCredential,
              index: commit.generation.index,
              type: 'welcome',
              welcome,
            }),
          );
        }),
      );
    }

    return commit;
  }

  /**
   * Asks each of these roster members for a key package, once per session;
   * only this device, in this session, takes the answer and adds the member
   * (`receiveMemberKeyPackage`). A request is awaited before it is sent, so
   * an answer that overtakes the send still counts. Rejects while this
   * device awaits the group's confirmation, when it may not add members, or
   * when the roster does not list one of them.
   */
  public async add(
    conversationId: string,
    identityIds: readonly string[],
  ): Promise<void> {
    const roster = await this.current(conversationId);

    if (
      !roster.manages(this.self.identityId) ||
      identityIds.some((identityId) => !roster.has(identityId))
    ) {
      throw new MlsRejectedError('Only roster members can be added');
    }

    for (const identityId of identityIds) {
      const key = JSON.stringify([conversationId, identityId]);

      if (this.asked.has(key)) continue;
      const requestId = MailboxChannel.randomEnvelopeId();

      this.awaited.set(requestId, key);
      await this.request(conversationId, identityId, requestId);
      this.asked.add(key);
    }
  }

  /** Adds `identityId` to the roster, then asks it for a key package. */
  public async addMember(
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.changeRoster(
      conversationId,
      (await this.current(conversationId)).withMember(identityId),
    );
    await this.add(conversationId, [identityId]);
  }

  /**
   * Adds other devices of this identity, by device credential: one key
   * package each, asked of that device. The commit reaches every existing
   * member; each device gets a `{welcome, k}` naming it.
   */
  public async addDevices(
    conversationId: string,
    deviceCredentials: readonly string[],
  ): Promise<GroupMailboxCommit> {
    const keyPackages = await Promise.all(
      deviceCredentials.map((deviceCredential) =>
        this.requestDeviceKeyPackage(conversationId, deviceCredential),
      ),
    );

    return this.welcome(conversationId, keyPackages);
  }

  /**
   * Drops unanswered key package requests: device adds reject, and an answer
   * from a member asked is no longer taken.
   */
  public close(): void {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new GroupMailboxKeyPackageTimeoutError());
    }
    this.pending.clear();
    this.awaited.clear();
  }

  /** Demotes an admin; only the creator may. */
  public async demote(
    conversationId: string,
    identityId: string,
  ): Promise<GroupMailboxCommit> {
    return this.changeRoster(
      conversationId,
      (await this.current(conversationId)).demoted(identityId),
    );
  }

  /**
   * Takes this identity off the roster, and off the admins when it is one;
   * the creator never leaves. A manager removes its leaves later.
   */
  public async leave(conversationId: string): Promise<GroupMailboxCommit> {
    return this.changeRoster(
      conversationId,
      (await this.current(conversationId)).withoutMember(this.self.identityId),
    );
  }

  /** Promotes a member to admin; only the creator may. */
  public async promote(
    conversationId: string,
    identityId: string,
  ): Promise<GroupMailboxCommit> {
    return this.changeRoster(
      conversationId,
      (await this.current(conversationId)).promoted(identityId),
    );
  }

  /**
   * A record `peerIdentityId` sent this identity directly. The link that
   * read it verified the peer's signature, so the peer is its author. A
   * key-package request the user accepted as a group invitation comes back
   * `consented`.
   */
  public async receiveDirect(
    peerIdentityId: string,
    plaintext: Uint8Array,
    consented = false,
  ): Promise<GroupMailboxControlOutcome> {
    const record = GroupMailboxControlRecord.decode(plaintext);

    switch (record?.type) {
      case 'key-package-request':
        return this.receiveKeyPackageRequest(peerIdentityId, record, consented);
      case 'key-package-response':
        return peerIdentityId === this.self.identityId
          ? this.receiveDeviceKeyPackage(
              record.conversationId,
              record.requestId,
              record.keyPackage,
            )
          : this.receiveMemberKeyPackage(peerIdentityId, record);
      case 'welcome':
        return this.receiveWelcome(peerIdentityId, record);
      default:
        return 'ignored';
    }
  }

  /** A record read from this identity's inbox of the conversation. */
  public async receiveGroup(
    conversationId: string,
    plaintext: Uint8Array,
  ): Promise<GroupMailboxControlOutcome> {
    const record = GroupMailboxControlRecord.decode(plaintext);

    if (record?.type !== 'commit' || record.conversationId !== conversationId) {
      return 'ignored';
    }

    return this.rejecting(() =>
      this.engine.applyCommit(conversationId, record.commit),
    );
  }

  /**
   * Removes a member from the roster and all its leaves in one commit; the
   * removed member gets it too and learns it left.
   */
  public async removeMember(
    conversationId: string,
    identityId: string,
  ): Promise<GroupMailboxCommit> {
    return this.changeRoster(
      conversationId,
      (await this.current(conversationId)).withoutMember(identityId),
    );
  }

  /**
   * Removes the leaves of identities the roster no longer lists; their
   * identities get the commit too and learn they left.
   */
  public async remove(
    conversationId: string,
    identityIds: readonly string[],
  ): Promise<GroupMailboxCommit | undefined> {
    const commit = await this.engine.remove(
      conversationId,
      [...identityIds],
      (made) => this.outbox.enqueueCommit(conversationId, made),
    );

    if (!commit) return undefined;
    await this.outbox.flush();

    return commit;
  }

  /**
   * Removes the leaves of other devices of this identity, by device
   * credential; the commit reaches the members that held a leaf before it.
   */
  public async removeDevices(
    conversationId: string,
    deviceCredentials: readonly string[],
  ): Promise<GroupMailboxCommit | undefined> {
    const commit = await this.engine.removeDevices(
      conversationId,
      [...deviceCredentials],
      (made) => this.outbox.enqueueCommit(conversationId, made),
    );

    if (!commit) return undefined;
    await this.outbox.flush();

    return commit;
  }
}
