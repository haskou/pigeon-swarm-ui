import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';
import type { MlsOpenedMessage } from '@haskou/pigeon-swarm-crypto/mls';

import {
  BearerCapability,
  CommitmentId,
  MailboxKeySchedule,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { PigeonMailboxClient } from '../../../mailboxes/infrastructure/http/PigeonMailboxClient';
import type {
  MailboxChannel,
  MailboxReadTokens,
  OpenedMailboxPage,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageReaderSet } from '../../../messages/infrastructure/mailbox/DirectMessageReaderSet';
import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
import type { GroupMailboxGenerationRepository } from '../../domain/repositories/GroupMailboxGenerationRepository';
import type { GroupMailboxControl } from '../control/GroupMailboxControl';
import type { GroupMessageHistoryStore } from '../history/GroupMessageHistoryStore';
import type { GroupMailboxMlsEngine } from '../mls/GroupMailboxMlsEngine';
import type { GroupMailboxInboxStore } from './GroupMailboxInboxStore';

import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { MailboxUnavailableError } from '../../../mailboxes/domain/errors/MailboxUnavailableError';
import { DirectMessageInboxKeys } from '../../../messages/infrastructure/mailbox/DirectMessageInboxKeys';
import { DirectMessageMailboxRecord } from '../../../messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { GroupMailboxControlRecord } from '../control/GroupMailboxControlRecord';
import { GroupMessageAuthors } from './GroupMessageAuthors';

/**
 * Recipient pass of a group conversation (node
 * `docs/design/group-mailboxes.md`, D4, D9): reads this identity's inbox
 * `I(self,k)` of every readable generation, oldest first, so a commit is
 * applied before the messages of the generation it starts. The first read
 * of a generation creates its inbox. A commit goes to the control; a message
 * is decrypted by MLS, whose sender must be the record's author and must
 * own the record's id (`CommitmentId.groupMessage`). An edit or a deletion
 * counts only from the author of its target message. Accepted records are
 * stored on this device, except typing notices and identity updates, which
 * are only handed on; every accepted record is handed to the caller, then
 * the page is acknowledged; a
 * rejected envelope is acknowledged too, so it cannot stall the inbox, and
 * so is an envelope that failed to open `MAX_FAILURES` times.
 *
 * A message from an epoch this device has not reached is rejected, not kept
 * for later: every epoch change here is a membership change, which also
 * starts a new generation, so a member's genuine message of the next epoch
 * lands in the next generation's inbox, read after the commit. A commit that
 * changes the epoch but not the members (a self-update) would break this;
 * adding one needs a bounded local buffer of such envelopes, acknowledged,
 * and retried after the next applied commit. Inboxes whose drain window
 * closed are deleted. Logs carry counts only.
 *
 * Readers derive from the session's device-sealed root, read on each pass,
 * so a revoke's rotation applies at once. Before an inbox is read, the
 * device reader is enrolled under the root reader, bridged through the root
 * the revoke replaced (`DirectMessageReaderSet`), and the readers no
 * remaining device holds are pruned.
 *
 * All devices of this identity holding a leaf read the same inbox, each
 * through its own reader. Before it first acknowledges the current
 * generation's inbox, a device enrols the reader of every other device of
 * its identity holding a leaf, so envelopes wait for each of them. A
 * drained inbox is deleted only once every reader has acknowledged as far
 * as this device; otherwise the node's retention expires it.
 */
export class GroupMailboxInboxSync {
  public static readonly MAX_FAILURES = 5;
  public static readonly MAX_ROUNDS = 8;
  public static readonly PAGE_SIZE = 50;

  /** Record types any member may send under its own id. */
  private static readonly UNCLAIMED: ReadonlySet<string> = new Set([
    DirectMailboxRecords.TYPE.pin,
    DirectMailboxRecords.TYPE.pollVote,
    DirectMailboxRecords.TYPE.reaction,
    DirectMailboxRecords.TYPE.typing,
    DirectMailboxRecords.TYPE.identityUpdated,
  ]);

  /** Record types only handed on, never stored on this device. */
  private static readonly EPHEMERAL: ReadonlySet<string> = new Set([
    DirectMailboxRecords.TYPE.typing,
    DirectMailboxRecords.TYPE.identityUpdated,
  ]);

  /** Sibling readers enrolled this app session, by mailbox and reader. */
  private readonly enrolled = new Set<string>();
  /** Drained inboxes a sibling still reads, left alone this app session. */
  private readonly unsettled = new Set<string>();

  /**
   * Whether `sender` may send `record`: only under an id it owns; an edit
   * or a deletion only for its own message, a message or a poll only under
   * an id no other author holds, a poll close only for its own poll; pins,
   * votes, reactions, typing notices and identity updates from any member.
   * Read receipts have no meaning in a group, and any other type is refused.
   */
  private static async authorized(
    record: DirectMessageRecord,
    sender: string,
    authors: GroupMessageAuthors,
  ): Promise<boolean> {
    if (!CommitmentId.isGroupMessageOf(record.id, sender)) return false;

    switch (record.type) {
      case DirectMailboxRecords.TYPE.sent:
      case DirectMailboxRecords.TYPE.poll:
        return authors.claim(record.id, sender);
      case DirectMailboxRecords.TYPE.edited:
      case DirectMailboxRecords.TYPE.deleted:
        return authors.owns(record.targetMessageId, sender);
      case DirectMailboxRecords.TYPE.pollClose:
        return authors.owns(record.targetPollId, sender);
      default:
        return GroupMailboxInboxSync.UNCLAIMED.has(record.type);
    }
  }

  public constructor(
    private readonly session: () => Session,
    private readonly engine: Pick<
      GroupMailboxMlsEngine,
      'decrypt' | 'devices' | 'drainedGenerations' | 'readableGenerations'
    >,
    private readonly control: Pick<GroupMailboxControl, 'receiveGroup'>,
    private readonly channel: Pick<
      MailboxChannel,
      'acknowledge' | 'addReader' | 'listReaders' | 'read'
    >,
    private readonly client: Pick<PigeonMailboxClient, 'delete'>,
    private readonly inboxes: GroupMailboxInboxStore,
    private readonly history: Pick<
      GroupMessageHistoryStore,
      'append' | 'author'
    >,
    private readonly generations: Pick<
      GroupMailboxGenerationRepository,
      'conversationIds'
    >,
    private readonly readerSet: Pick<
      DirectMessageReaderSet,
      'cutOff' | 'enrolSealedRoot' | 'reconcile'
    >,
  ) {}

  /**
   * The application record of one message envelope, or null when MLS
   * rejects it or its sender may not send it.
   */
  private async accepted(
    conversationId: string,
    ciphertext: Uint8Array,
    authors: GroupMessageAuthors,
    envelope: { envelopeId: string; mailboxId: string },
  ): Promise<DirectMessageRecord | null> {
    const opened = await this.opened(conversationId, ciphertext, envelope);

    if (!opened) return null;
    const sender = opened.sender.identityId;
    const record = DirectMessageMailboxRecord.decode(
      opened.plaintext,
      conversationId,
      (candidate) => candidate.authorId === sender,
    );

    return record &&
      (await GroupMailboxInboxSync.authorized(record, sender, authors))
      ? record
      : null;
  }

  /** Acknowledges a page; an inbox re-created meanwhile restarts at 0. */
  private async acknowledge(
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
    upTo: number,
  ): Promise<void> {
    const { recreated } = await this.channel.acknowledge(keys, readers, upTo);

    this.inboxes.saveCursor(keys.mailboxId, recreated ? 0 : upTo);
  }

  /**
   * Deletes this identity's inboxes whose drain window has closed, once
   * every reader acknowledged as far as this device. Logs counts only.
   */
  private async deleteDrained(conversationId: string): Promise<void> {
    const session = this.session();
    let waiting = 0;

    for (const generation of await this.engine.drainedGenerations(
      conversationId,
    )) {
      const keys = this.keysFor(session, generation);

      if (
        !this.inboxes.isDeleted(keys.mailboxId) &&
        !this.unsettled.has(keys.mailboxId) &&
        !(await this.deleteSettled(
          keys,
          DirectMessageInboxKeys.readersFor(session, keys),
        ))
      ) {
        waiting += 1;
      }
    }

    if (waiting > 0) {
      // eslint-disable-next-line no-console
      console.debug(`Group inboxes left to retention: ${waiting}.`);
    }
  }

  /**
   * Deletes a drained inbox when every reader acknowledged as far as this
   * device. Resolves false when a reader lags, and leaves the inbox to the
   * node's retention for this app session; a failed delete is retried on the
   * next sync.
   */
  private async deleteSettled(
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<boolean> {
    try {
      if (!(await this.settled(keys, readers))) {
        this.unsettled.add(keys.mailboxId);

        return false;
      }
      await this.client.delete(keys.mailboxId, readers.root);
    } catch (error: unknown) {
      if (!(error instanceof MailboxUnavailableError)) {
        // eslint-disable-next-line no-console
        console.debug('Group inbox delete failed.');

        return true;
      }
    }
    this.inboxes.markDeleted(keys.mailboxId);

    return true;
  }

  /**
   * Enrols the device reader under the session's root, bridged from the root
   * a revoke replaced, then prunes the readers no remaining device holds.
   * A missing inbox is left to the read, which creates it.
   */
  private async bridgeReaders(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    try {
      await this.readerSet.enrolSealedRoot(session, keys, readers);
      await this.readerSet.reconcile(session, keys, readers);
    } catch (error: unknown) {
      if (!(error instanceof MailboxUnavailableError)) {
        // Count-only: no ids, content, or error details.
        // eslint-disable-next-line no-console
        console.debug('Group inbox reader enrol failed; retried next sync.');
      }
    }
  }

  /**
   * Reads one inbox to its end. True when a commit was applied, so the
   * generations are listed again. A first read creates a missing inbox.
   * The readers of `siblings`, other devices of this identity, are
   * enrolled before the first acknowledgement.
   */
  private async drain(
    conversationId: string,
    generation: GroupMailboxGeneration,
    siblings: readonly string[],
    authors: GroupMessageAuthors,
    signal: AbortSignal,
    apply: (records: DirectMessageRecord[]) => void,
  ): Promise<boolean> {
    const session = this.session();
    const keys = this.keysFor(session, generation);
    const readers = DirectMessageInboxKeys.readersFor(session, keys);
    let advanced = false;

    await this.bridgeReaders(session, keys, readers);

    for (;;) {
      if (signal.aborted) return advanced;
      const page = await this.readPage(keys, readers);
      const { accepted, applied } = await this.openedPage(
        conversationId,
        keys.mailboxId,
        page,
        authors,
      );

      await this.history.append(
        session,
        accepted.filter(
          ({ type }) => !GroupMailboxInboxSync.EPHEMERAL.has(type),
        ),
      );

      if (signal.aborted) return advanced;
      apply(accepted);
      await this.enrolSiblings(session, keys, readers.root, siblings);
      await this.acknowledge(keys, readers, page.lastCursor);
      advanced = advanced || applied;

      if (!page.hasMore || page.envelopes.length === 0) return advanced;
    }
  }

  /**
   * Enrols the readers of other devices of this identity, once per mailbox
   * and reader per app session. Rejects when one cannot be enrolled, so the
   * page stays unacknowledged.
   */
  private async enrolSiblings(
    session: Session,
    keys: MailboxInboxKeys,
    rootToken: string,
    siblings: readonly string[],
  ): Promise<void> {
    for (const credential of siblings) {
      const { device } = DirectMessageInboxKeys.readersFor(
        session,
        keys,
        credential,
      );
      const key = `${keys.mailboxId}:${BearerCapability.hash(device)}`;

      if (this.enrolled.has(key)) continue;
      await this.channel.addReader(keys, rootToken, device);
      this.enrolled.add(key);
    }
  }

  private keysFor(
    session: Session,
    generation: GroupMailboxGeneration,
  ): MailboxInboxKeys {
    return MailboxKeySchedule.groupInbox(
      generation.secret.toSymmetricKey(),
      IdentityId.fromString(session.identity.id).valueOf(),
    );
  }

  /**
   * The decrypted message, or null when MLS rejects it. Any other failure
   * is rethrown, so the page is read again, until the envelope failed
   * `MAX_FAILURES` times; it is then dropped like a rejected one.
   */
  private async opened(
    conversationId: string,
    ciphertext: Uint8Array,
    { envelopeId, mailboxId }: { envelopeId: string; mailboxId: string },
  ): Promise<MlsOpenedMessage | null> {
    try {
      return await this.engine.decrypt(conversationId, ciphertext);
    } catch (error: unknown) {
      if (error instanceof MlsRejectedError) return null;
      const failures = this.inboxes.failures(mailboxId, envelopeId) + 1;

      if (failures < GroupMailboxInboxSync.MAX_FAILURES) {
        this.inboxes.saveFailures(mailboxId, envelopeId, failures);
        throw error;
      }
      // eslint-disable-next-line no-console
      console.debug('Group envelope dropped after repeated failures.', {
        failures,
      });

      return null;
    }
  }

  /**
   * Hands the page's commits to the control and keeps the accepted
   * messages of inbox `mailboxId`. `applied` tells whether a commit moved
   * the group on.
   */
  private async openedPage(
    conversationId: string,
    mailboxId: string,
    page: OpenedMailboxPage,
    authors: GroupMessageAuthors,
  ): Promise<{ accepted: DirectMessageRecord[]; applied: boolean }> {
    const accepted: (DirectMessageRecord | null)[] = [];
    let applied = false;

    for (const { envelopeId, plaintext } of page.envelopes) {
      const record = GroupMailboxControlRecord.decode(plaintext);

      if (record?.conversationId !== conversationId) continue;

      if (record.type === 'commit') {
        applied =
          (await this.control.receiveGroup(conversationId, plaintext)) ===
            'applied' || applied;
      } else if (record.type === 'message') {
        accepted.push(
          await this.accepted(conversationId, record.ciphertext, authors, {
            envelopeId,
            mailboxId,
          }),
        );
      }
    }

    return {
      accepted: accepted.filter((record) => record !== null),
      applied,
    };
  }

  /**
   * Reads from the stored cursor. An inbox re-created under that cursor
   * numbers its envelopes from 1 again, so it is read again from zero.
   */
  private async readPage(
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<OpenedMailboxPage> {
    const cursor = this.inboxes.cursor(keys.mailboxId);
    const page = await this.channel.read(
      keys,
      readers,
      cursor,
      GroupMailboxInboxSync.PAGE_SIZE,
    );

    if (!page.recreated || cursor === 0) return page;
    this.inboxes.saveCursor(keys.mailboxId, 0);

    return this.channel.read(keys, readers, 0, GroupMailboxInboxSync.PAGE_SIZE);
  }

  /**
   * Drains the readable generations oldest first. True when a commit was
   * applied, so the generations must be listed again. Only the current
   * generation's inbox enrols the other devices holding a leaf: older
   * ones predate some of them, who would never read them.
   */
  private async round(
    conversationId: string,
    authors: GroupMessageAuthors,
    signal: AbortSignal,
    apply: (records: DirectMessageRecord[]) => void,
  ): Promise<boolean> {
    const readable = await this.engine.readableGenerations(conversationId);
    const [current] = readable;
    const own = this.session().deviceCredentialKeyPair.toPrimitives().publicKey;
    const siblings = current
      ? (await this.engine.devices(conversationId)).filter(
          (credential) => credential !== own,
        )
      : [];

    for (const generation of [...readable].reverse()) {
      if (signal.aborted) return false;

      if (
        await this.drain(
          conversationId,
          generation,
          generation === current ? siblings : [],
          authors,
          signal,
          apply,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /** Whether every reader acknowledged as far as this device's reader. */
  private async settled(
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<boolean> {
    const listed = await this.channel.listReaders(keys, readers.root);
    const own = BearerCapability.hash(readers.device);
    const mine = listed.readers.find((reader) => reader.readTokenHash === own);

    return (
      mine !== undefined &&
      listed.readers.every((reader) => reader.ackedCursor >= mine.ackedCursor)
    );
  }

  /**
   * A revoke's cut-off of this identity's readable group inboxes: bridges
   * the rotated root in and prunes every reader no remaining device holds,
   * so the replaced root and the revoked device stop reading them. Tries
   * every inbox, then rejects with the first failure.
   */
  public async cutOffRevokedReaders(): Promise<void> {
    const session = this.session();
    const failures: unknown[] = [];

    for (const conversationId of await this.generations.conversationIds()) {
      for (const generation of await this.engine.readableGenerations(
        conversationId,
      )) {
        const keys = this.keysFor(session, generation);

        await this.readerSet
          .cutOff(
            session,
            keys,
            DirectMessageInboxKeys.readersFor(session, keys),
          )
          .catch((error: unknown) => failures.push(error));
      }
    }

    if (failures.length > 0) throw failures[0];
  }

  /**
   * One pass over the conversation. `apply` receives the accepted records
   * of each page before it is acknowledged; it may see a record again after
   * a crash, so it applies records by id.
   */
  public async sync(
    conversationId: string,
    signal: AbortSignal,
    apply: (records: DirectMessageRecord[]) => void,
  ): Promise<void> {
    const authors = new GroupMessageAuthors(
      this.session(),
      conversationId,
      this.history,
    );
    let advanced = true;

    for (
      let round = 0;
      advanced && round < GroupMailboxInboxSync.MAX_ROUNDS;
      round += 1
    ) {
      advanced = await this.round(conversationId, authors, signal, apply);
    }

    if (!signal.aborted) await this.deleteDrained(conversationId);
  }
}
