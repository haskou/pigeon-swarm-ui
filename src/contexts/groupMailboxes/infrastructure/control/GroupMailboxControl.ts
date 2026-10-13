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
import { GroupMailboxControlRecord } from './GroupMailboxControlRecord';
import { GroupMailboxKeyPackageTimeoutError } from './GroupMailboxKeyPackageTimeoutError';

/**
 * Control traffic of a group conversation (node
 * `docs/design/group-mailboxes.md`, D8). An inviter asks each joiner for a
 * key package over their 1:1 mailbox, commits the add, queues the commit in
 * the durable outbox for every existing member's inbox of the generation the
 * commit was made in, and hands each joiner `{welcome, k}` over the 1:1
 * mailbox. A removal is delivered the same way, to the remaining members
 * only. Only the
 * conversation roster can request key packages or send welcomes; MLS
 * authenticates commits. Logs never carry key material, welcomes or
 * commits.
 */
export class GroupMailboxControl {
  public static readonly KEY_PACKAGE_TIMEOUT_MS = 60_000;

  private readonly pending = new Map<string, PendingGroupMailboxKeyPackage>();

  /** The identity a key package's credential names, if it decodes. */
  private static ownerOf(keyPackage: Uint8Array): string | undefined {
    try {
      return mlsKeyPackageOwner(keyPackage).identityId;
    } catch {
      return undefined;
    }
  }

  public constructor(
    private readonly selfIdentityId: string,
    private readonly engine: GroupMailboxControlEngine,
    private readonly rosterFor: (
      conversationId: string,
    ) => Promise<ReadonlySet<string>>,
    private readonly direct: GroupMailboxDirectLink,
    private readonly outbox: Pick<GroupMailboxOutbox, 'enqueueCommit'>,
  ) {}

  /** The peer and this device both belong to the conversation roster. */
  private async bothInRoster(
    conversationId: string,
    peerIdentityId: string,
  ): Promise<boolean> {
    const roster = await this.rosterFor(conversationId);

    return (
      peerIdentityId !== this.selfIdentityId &&
      roster.has(peerIdentityId) &&
      roster.has(this.selfIdentityId)
    );
  }

  private async receiveKeyPackageRequest(
    peerIdentityId: string,
    conversationId: string,
    requestId: string,
  ): Promise<GroupMailboxControlOutcome> {
    if (!(await this.bothInRoster(conversationId, peerIdentityId))) {
      return 'ignored';
    }

    await this.direct.send(
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
   * key package must be that peer's.
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

    if (GroupMailboxControl.ownerOf(keyPackage) !== peerIdentityId) {
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

  private async receiveWelcome(
    peerIdentityId: string,
    record: Extract<GroupMailboxControlFields, { type: 'welcome' }>,
  ): Promise<GroupMailboxControlOutcome> {
    if (!(await this.bothInRoster(record.conversationId, peerIdentityId))) {
      return 'rejected';
    }

    return this.rejecting(() =>
      this.engine.join(record.conversationId, record.welcome, record.index),
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

  private async requestKeyPackage(
    conversationId: string,
    peerIdentityId: string,
  ): Promise<Uint8Array> {
    const requestId = MailboxChannel.randomEnvelopeId();
    const answer = new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(requestId, {
        conversationId,
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
        peerIdentityId,
        GroupMailboxControlRecord.encode({
          conversationId,
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
   * Adds identities from the roster: one key package each, asked over the
   * 1:1 mailbox. The commit reaches every existing member; each joiner gets
   * `{welcome, k}`.
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
    const existing = await this.engine.members(conversationId);
    const commit = await this.engine.add(conversationId, keyPackages);

    await this.outbox.enqueueCommit(conversationId, commit, existing);
    const { welcome } = commit;

    if (welcome) {
      const plaintext = GroupMailboxControlRecord.encode({
        conversationId,
        index: commit.generation.index,
        type: 'welcome',
        welcome,
      });

      await Promise.all(
        identityIds.map((identityId) =>
          this.direct.send(identityId, plaintext),
        ),
      );
    }

    return commit;
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
   * A record read from the 1:1 mailbox shared with `peerIdentityId`. That
   * mailbox authenticates the peer, so it is the author.
   */
  public async receiveDirect(
    peerIdentityId: string,
    plaintext: Uint8Array,
  ): Promise<GroupMailboxControlOutcome> {
    const record = GroupMailboxControlRecord.decode(plaintext);

    switch (record?.type) {
      case 'key-package-request':
        return this.receiveKeyPackageRequest(
          peerIdentityId,
          record.conversationId,
          record.requestId,
        );
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
    const commit = await this.engine.remove(conversationId, [...identityIds]);

    if (!commit) return undefined;
    await this.outbox.enqueueCommit(
      conversationId,
      commit,
      await this.engine.members(conversationId),
    );

    return commit;
  }
}
