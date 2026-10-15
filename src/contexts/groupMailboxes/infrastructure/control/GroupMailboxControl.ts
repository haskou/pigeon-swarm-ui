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
 * `docs/design/group-mailboxes.md`, D8). An inviter asks each joiner for a
 * key package in a letter signed by its identity key and sealed to the
 * joiner (`GroupMailboxNotificationLink`); the key package's credential
 * must be signed by that joiner's identity key. The inviter commits the
 * add, which is kept only once the durable outbox has queued it for every
 * existing member's inbox of the generation the commit was made in, and
 * hands each joiner `{welcome, k}` in another letter. A removal is
 * delivered through the outbox to the remaining members only. Only the
 * conversation roster can request key packages; a welcome counts only from
 * a peer the roster lets add members and who holds a leaf in the welcomed
 * group. MLS authenticates commits and the roster decides who may make
 * them. Logs never carry key material, welcomes or commits.
 *
 * A device also adds and removes the other devices of its own identity:
 * it sends its identity a key-package request naming one device, which
 * only that device answers, and only while it holds no leaf; the answer's
 * key package must be that device's.
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
 * packages for it.
 */
export class GroupMailboxControl {
  public static readonly KEY_PACKAGE_TIMEOUT_MS = 60_000;

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
    private readonly rosterFor: (
      conversationId: string,
    ) => Promise<GroupMailboxRoster>,
    private readonly direct: GroupMailboxDirectLink,
    private readonly outbox: Pick<
      GroupMailboxOutbox,
      'enqueueCommit' | 'flush'
    >,
  ) {}

  /** The peer and this device both belong to the conversation roster. */
  private async bothInRoster(
    conversationId: string,
    peerIdentityId: string,
  ): Promise<boolean> {
    const roster = await this.rosterFor(conversationId);

    return roster.has(peerIdentityId) && roster.has(this.self.identityId);
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
   * asks another device; rejected from outside the roster, from another
   * device of this identity that names no device, or by one while this
   * device already holds a leaf; else as `heldBack` decides.
   */
  private async refusal(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
  ): Promise<GroupMailboxControlOutcome | undefined> {
    const { conversationId, deviceCredential } = record;
    const sibling = peerIdentityId === this.self.identityId;

    if (
      deviceCredential !== undefined &&
      deviceCredential !== this.self.deviceCredential
    ) {
      return 'ignored';
    }

    if (
      (sibling && deviceCredential === undefined) ||
      !(await this.bothInRoster(conversationId, peerIdentityId)) ||
      (sibling && (await this.engine.devices(conversationId)).length > 0)
    ) {
      return 'rejected';
    }

    return this.heldBack(record);
  }

  /**
   * Answers a peer on the roster, or another device of this identity that
   * asks this very device while it holds no leaf in the group. Keeps the
   * genesis the request carries. A device awaiting the group's
   * confirmation answers nobody.
   */
  private async receiveKeyPackageRequest(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'key-package-request' }>,
  ): Promise<GroupMailboxControlOutcome> {
    const { conversationId, requestId } = record;
    const refused = await this.refusal(peerIdentityId, record);

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
   * Only an answer to a request this device sent that peer counts, and its
   * key package must be that peer's, and that device's when one was asked.
   */
  private receiveKeyPackageResponse(
    peerIdentityId: string,
    conversationId: string,
    requestId: string,
    keyPackage: Uint8Array,
  ): GroupMailboxControlOutcome {
    const waiting = this.pending.get(requestId);

    if (
      waiting?.peerIdentityId !== peerIdentityId ||
      waiting.conversationId !== conversationId
    ) {
      return 'ignored';
    }
    this.pending.delete(requestId);
    clearTimeout(waiting.timer);
    const owner = GroupMailboxControl.ownerOf(keyPackage);

    if (
      owner?.identityId !== peerIdentityId ||
      (waiting.deviceCredential !== undefined &&
        owner.deviceCredential !== waiting.deviceCredential)
    ) {
      // eslint-disable-next-line no-console
      console.debug('Group mailbox control record rejected.');
      waiting.reject(
        new MlsRejectedError('Key package does not belong to the peer'),
      );

      return 'rejected';
    }
    waiting.resolve(keyPackage);

    return 'applied';
  }

  /** Joins from a welcome naming this device, sent by a roster member. */
  private async receiveWelcome(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'welcome' }>,
  ): Promise<GroupMailboxControlOutcome> {
    if (record.deviceCredential !== this.self.deviceCredential) {
      return 'ignored';
    }

    if (!(await this.bothInRoster(record.conversationId, peerIdentityId))) {
      return 'rejected';
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

  /**
   * Asks a peer, or one other device of this identity, for a key package,
   * handing on the group's genesis when this device knows it. Rejects
   * while this device awaits the group's confirmation.
   */
  private async requestKeyPackage(
    conversationId: string,
    peerIdentityId: string,
    deviceCredential?: string,
  ): Promise<Uint8Array> {
    if (await this.engine.awaitsConfirmation(conversationId)) {
      throw new GroupMailboxUnconfirmedError();
    }
    const genesis = await this.engine.genesis(conversationId);
    const requestId = MailboxChannel.randomEnvelopeId();
    const answer = new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(requestId, {
        conversationId,
        ...(deviceCredential === undefined ? {} : { deviceCredential }),
        peerIdentityId,
        reject,
        resolve,
        timer: setTimeout(() => {
          this.pending.delete(requestId);
          reject(new GroupMailboxKeyPackageTimeoutError());
        }, GroupMailboxControl.KEY_PACKAGE_TIMEOUT_MS),
      });
    });

    try {
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
   * Adds identities from the roster: one key package each, asked in a
   * signed letter. The commit reaches every existing member; each joiner
   * gets `{welcome, k}`.
   */
  public async add(
    conversationId: string,
    identityIds: readonly string[],
  ): Promise<GroupMailboxCommit> {
    const roster = await this.rosterFor(conversationId);

    if (identityIds.some((identityId) => !roster.has(identityId))) {
      throw new MlsRejectedError('Only roster members can be added');
    }
    const keyPackages = await Promise.all(
      identityIds.map((identityId) =>
        this.requestKeyPackage(conversationId, identityId),
      ),
    );

    return this.welcome(conversationId, keyPackages);
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
        this.requestKeyPackage(
          conversationId,
          this.self.identityId,
          deviceCredential,
        ),
      ),
    );

    return this.welcome(conversationId, keyPackages);
  }

  /** Drops unanswered key package requests; their adds reject. */
  public close(): void {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new GroupMailboxKeyPackageTimeoutError());
    }
    this.pending.clear();
  }

  /**
   * A record `peerIdentityId` sent this identity directly. The link that
   * read it verified the peer's signature, so the peer is its author.
   */
  public async receiveDirect(
    peerIdentityId: string,
    plaintext: Uint8Array,
  ): Promise<GroupMailboxControlOutcome> {
    const record = GroupMailboxControlRecord.decode(plaintext);

    switch (record?.type) {
      case 'key-package-request':
        return this.receiveKeyPackageRequest(peerIdentityId, record);
      case 'key-package-response':
        return this.receiveKeyPackageResponse(
          peerIdentityId,
          record.conversationId,
          record.requestId,
          record.keyPackage,
        );
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

  /** Removes identities; the commit reaches the remaining members only. */
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
   * credential; the commit reaches the remaining members.
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
