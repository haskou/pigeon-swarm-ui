import type { MlsOpenedMessage } from '../../../communities/infrastructure/mls/MlsGroup';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from '../../../mailboxes/infrastructure/http/PigeonMailboxClient';
import type {
  MailboxChannel,
  MailboxReadTokens,
  OpenedMailboxPage,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
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
import { GroupMailboxKeySchedule } from '../crypto/GroupMailboxKeySchedule';

/**
 * Recipient pass of a group conversation (node
 * `docs/design/group-mailboxes.md`, D4, D9): reads this identity's inbox
 * `I(self,k)` of every readable generation, oldest first, so a commit is
 * applied before the messages of the generation it starts. The first read
 * of a generation creates its inbox. A commit goes to the control; a message
 * is decrypted by MLS, whose sender must be the record's author. An edit or
 * a deletion counts only from the author of its target message. Accepted
 * records are stored on this device, handed to the caller, then the page is
 * acknowledged; a rejected envelope is acknowledged too, so it cannot stall
 * the inbox. Inboxes whose drain window closed are deleted. Logs carry
 * counts only.
 */
export class GroupMailboxInboxSync {
  public static readonly MAX_ROUNDS = 8;
  public static readonly PAGE_SIZE = 50;

  /**
   * Whether `sender` may send `record`: an edit or a deletion only for its
   * own message, a message only under an id no other author holds. Read
   * receipts have no meaning in a group.
   */
  private static authorized(
    record: DirectMessageRecord,
    sender: string,
    authors: Map<string, string>,
  ): boolean {
    switch (record.type) {
      case DirectMailboxRecords.TYPE.sent:
        return GroupMailboxInboxSync.claimed(record.id, sender, authors);
      case DirectMailboxRecords.TYPE.edited:
      case DirectMailboxRecords.TYPE.deleted:
        return authors.get(record.targetMessageId) === sender;
      case DirectMailboxRecords.TYPE.pin:
      case DirectMailboxRecords.TYPE.reaction:
        return true;
      case DirectMailboxRecords.TYPE.read:
        return false;
    }
  }

  /** Records `sender` as the author of `id` unless another author holds it. */
  private static claimed(
    id: string,
    sender: string,
    authors: Map<string, string>,
  ): boolean {
    if ((authors.get(id) ?? sender) !== sender) return false;
    authors.set(id, sender);

    return true;
  }

  public constructor(
    private readonly session: Session,
    private readonly engine: Pick<
      GroupMailboxMlsEngine,
      'decrypt' | 'drainedGenerations' | 'readableGenerations'
    >,
    private readonly control: Pick<GroupMailboxControl, 'receiveGroup'>,
    private readonly channel: Pick<MailboxChannel, 'acknowledge' | 'read'>,
    private readonly client: Pick<PigeonMailboxClient, 'delete'>,
    private readonly inboxes: GroupMailboxInboxStore,
    private readonly history: Pick<GroupMessageHistoryStore, 'append' | 'load'>,
  ) {}

  /**
   * The application record of one message envelope, or null when MLS
   * rejects it or its sender may not send it.
   */
  private async accepted(
    conversationId: string,
    ciphertext: Uint8Array,
    authors: Map<string, string>,
  ): Promise<DirectMessageRecord | null> {
    const opened = await this.opened(conversationId, ciphertext);

    if (!opened) return null;
    const sender = opened.sender.identityId;
    const record = DirectMessageMailboxRecord.decode(
      opened.plaintext,
      conversationId,
      (candidate) => candidate.authorId === sender,
    );

    return record && GroupMailboxInboxSync.authorized(record, sender, authors)
      ? record
      : null;
  }

  /** Acknowledges a page; an inbox re-created meanwhile restarts at 0. */
  private async acknowledge(
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    upTo: number,
  ): Promise<void> {
    const { recreated } = await this.channel.acknowledge(keys, readers, upTo);

    this.inboxes.saveCursor(keys.mailboxId, recreated ? 0 : upTo);
  }

  /** The authors of the sent messages this device holds. */
  private async authorsOf(
    conversationId: string,
  ): Promise<Map<string, string>> {
    const authors = new Map<string, string>();

    for (const record of await this.history.load(
      this.session,
      conversationId,
    )) {
      if (record.type === DirectMailboxRecords.TYPE.sent) {
        authors.set(record.id, record.authorId);
      }
    }

    return authors;
  }

  /** Deletes this identity's inboxes whose drain window has closed. */
  private async deleteDrained(conversationId: string): Promise<void> {
    for (const generation of await this.engine.drainedGenerations(
      conversationId,
    )) {
      const keys = this.keysFor(generation);

      if (this.inboxes.isDeleted(keys.mailboxId)) continue;

      try {
        await this.client.delete(
          keys.mailboxId,
          DirectMessageInboxKeys.readersFor(this.session, keys).root,
        );
      } catch (error: unknown) {
        if (!(error instanceof MailboxUnavailableError)) {
          // eslint-disable-next-line no-console
          console.debug('Group inbox delete failed.');
          continue;
        }
      }
      this.inboxes.markDeleted(keys.mailboxId);
    }
  }

  /**
   * Reads one inbox to its end. True when a commit was applied, so the
   * generations are listed again.
   */
  private async drain(
    conversationId: string,
    generation: GroupMailboxGeneration,
    authors: Map<string, string>,
    signal: AbortSignal,
    apply: (records: DirectMessageRecord[]) => void,
  ): Promise<boolean> {
    const keys = this.keysFor(generation);
    const readers = DirectMessageInboxKeys.readersFor(this.session, keys);
    let advanced = false;

    for (;;) {
      if (signal.aborted) return advanced;
      const page = await this.readPage(keys, readers);
      const { accepted, applied } = await this.openedPage(
        conversationId,
        page,
        authors,
      );

      await this.history.append(this.session, accepted);

      if (signal.aborted) return advanced;
      apply(accepted);
      await this.acknowledge(keys, readers, page.lastCursor);
      advanced = advanced || applied;

      if (!page.hasMore || page.envelopes.length === 0) return advanced;
    }
  }

  private keysFor(generation: GroupMailboxGeneration): MailboxKeys {
    return GroupMailboxKeySchedule.inbox(
      generation.secret,
      IdentityId.fromString(this.session.identity.id),
    );
  }

  /** The decrypted message, or null when MLS rejects it. */
  private async opened(
    conversationId: string,
    ciphertext: Uint8Array,
  ): Promise<MlsOpenedMessage | null> {
    try {
      return await this.engine.decrypt(conversationId, ciphertext);
    } catch (error: unknown) {
      if (error instanceof MlsRejectedError) return null;
      throw error;
    }
  }

  /**
   * Hands the page's commits to the control and keeps the accepted
   * messages. `applied` tells whether a commit moved the group on.
   */
  private async openedPage(
    conversationId: string,
    page: OpenedMailboxPage,
    authors: Map<string, string>,
  ): Promise<{ accepted: DirectMessageRecord[]; applied: boolean }> {
    const accepted: (DirectMessageRecord | null)[] = [];
    let applied = false;

    for (const { plaintext } of page.envelopes) {
      const record = GroupMailboxControlRecord.decode(plaintext);

      if (record?.conversationId !== conversationId) continue;

      if (record.type === 'commit') {
        applied =
          (await this.control.receiveGroup(conversationId, plaintext)) ===
            'applied' || applied;
      } else if (record.type === 'message') {
        accepted.push(
          await this.accepted(conversationId, record.ciphertext, authors),
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
    keys: MailboxKeys,
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
   * applied, so the generations must be listed again.
   */
  private async round(
    conversationId: string,
    authors: Map<string, string>,
    signal: AbortSignal,
    apply: (records: DirectMessageRecord[]) => void,
  ): Promise<boolean> {
    const oldestFirst = [
      ...(await this.engine.readableGenerations(conversationId)),
    ].reverse();

    for (const generation of oldestFirst) {
      if (signal.aborted) return false;

      if (
        await this.drain(conversationId, generation, authors, signal, apply)
      ) {
        return true;
      }
    }

    return false;
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
    const authors = await this.authorsOf(conversationId);
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
