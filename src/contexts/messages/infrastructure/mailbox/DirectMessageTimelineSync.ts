import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { OpenedMailboxPage } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { DirectMessageInboxOpener } from './DirectMessageInboxOpener';
import type {
  DirectEditedRecord,
  DirectMessageRecord,
  DirectReadRecord,
  DirectSentRecord,
} from './DirectMessageMailboxRecord';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';
import type { DirectMessageRecipientInbox } from './DirectMessageRecipientInbox';
import type { DirectMessageTimelineChange } from './DirectMessageTimelineChange';

import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageRecordReader } from './DirectMessageRecordReader';

/**
 * Recipient sync pass of the direct mailbox: reads the next page of this
 * identity's inbox, maps it to timeline changes, then acknowledges it.
 */
export class DirectMessageTimelineSync {
  public constructor(
    private readonly opener: DirectMessageInboxOpener,
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly readerSet: DirectMessageReaderSet,
    private readonly projection: Pick<MessageProjectionPort, 'decryptMany'>,
    private readonly ownCopies: DirectMessageOwnCopies,
  ) {}

  /**
   * Reads from the stored cursor. An inbox re-created under that cursor
   * numbers its envelopes from 1 again, so it is read again from zero. The
   * reset is saved before the second read, so a crash cannot leave the new
   * inbox behind the old cursor.
   */
  private async readPage(
    inbox: DirectMessageRecipientInbox,
  ): Promise<{ cursor: number; page: OpenedMailboxPage }> {
    const { keys, readers, state } = inbox;
    const page = await this.channel.read(
      keys,
      readers,
      state.cursor,
      DirectMessageMailboxLimits.PAGE_SIZE,
    );

    if (!page.recreated || state.cursor === 0) {
      return { cursor: state.cursor, page };
    }

    this.store.save(keys.mailboxId, { ...state, cursor: 0 });

    return {
      cursor: 0,
      page: await this.channel.read(
        keys,
        readers,
        0,
        DirectMessageMailboxLimits.PAGE_SIZE,
      ),
    };
  }

  /**
   * Decodes and decrypts the page, hands its changes to the caller, then
   * acknowledges it. Each step checks the signal so an aborted pass neither
   * applies nor acks.
   */
  private async applyPage(
    session: Session,
    conversationId: string,
    inbox: DirectMessageRecipientInbox,
    page: OpenedMailboxPage,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const { keys, readers, state } = inbox;
    const changes = await this.decryptPage(
      session,
      conversationId,
      page,
      signal,
    );

    if (signal.aborted) return;

    apply(changes);

    if (signal.aborted) return;

    const acked = await this.channel.acknowledge(
      keys,
      readers,
      page.lastCursor,
    );
    this.store.save(keys.mailboxId, {
      ...state,
      cursor: acked.recreated ? 0 : page.lastCursor,
    });
  }

  /**
   * Maps each decoded record to its timeline change, in envelope order. A
   * sent or edited record whose message does not decrypt drops only its own
   * change. Deletes and reactions carry no ciphertext and never decrypt.
   */
  private async decryptPage(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
    signal: AbortSignal,
  ): Promise<DirectMessageTimelineChange[]> {
    const records = page.envelopes.flatMap((envelope) => {
      const decoded = DirectMessageRecordReader.decode(
        session,
        conversationId,
        envelope.plaintext,
      );

      if (!decoded) return [];

      // An own copy this device appended is already shown locally.
      if (this.ownCopies.has(`${session.identity.id}:${decoded.id}`)) {
        return [];
      }

      return [decoded];
    });
    const messages = await this.decryptMessages(
      session,
      conversationId,
      records,
      signal,
    );

    return records.flatMap((record): DirectMessageTimelineChange[] => {
      switch (record.type) {
        case 'sent':
        case 'edited':
          return this.messageChanges(record, messages);
        case 'deleted':
          return [{ kind: 'removed', messageId: record.targetMessageId }];
        case 'reaction':
          return [
            {
              action: record.action,
              authorId: record.authorId,
              createdAt: record.createdAt,
              emoji: record.emoji,
              kind: 'reaction',
              messageId: record.targetMessageId,
            },
          ];
        case 'pin':
          return [
            {
              action: record.action,
              createdAt: record.createdAt,
              kind: 'pin',
              messageId: record.targetMessageId,
            },
          ];
        case 'read':
          return this.readChanges(session, record);
      }
    });
  }

  /**
   * A sent or edited record yields a change only when its message decrypted.
   */
  private messageChanges(
    record: DirectEditedRecord | DirectSentRecord,
    messages: Map<string, ChatMessage>,
  ): DirectMessageTimelineChange[] {
    const message = messages.get(record.id);

    if (!message || message.encrypted) return [];

    return [
      record.type === 'sent'
        ? { kind: 'message', message }
        : { kind: 'edit', message },
    ];
  }

  /**
   * A read receipt applies only when this identity wrote it and it is fresh.
   */
  private readChanges(
    session: Session,
    record: DirectReadRecord,
  ): DirectMessageTimelineChange[] {
    return DirectMessageRecordReader.isOwnFreshRead(session, record)
      ? [{ kind: 'read', messageId: record.targetMessageId }]
      : [];
  }

  /**
   * One batch decrypt for the sent and edited records of a page, keyed by
   * message id. Makes no call when the page has none.
   */
  private async decryptMessages(
    session: Session,
    conversationId: string,
    records: DirectMessageRecord[],
    signal: AbortSignal,
  ): Promise<Map<string, ChatMessage>> {
    const resources = records.flatMap((record) =>
      record.type === 'sent' || record.type === 'edited'
        ? [DirectMessageMailboxRecord.toResource(record)]
        : [],
    );

    if (resources.length === 0) return new Map();

    const messages = await this.projection.decryptMany(
      session,
      conversationId,
      resources,
      signal,
    );

    return new Map(
      messages.map((message): [string, ChatMessage] => [message.id, message]),
    );
  }

  /**
   * Recipient. Reads the next page of this identity's inbox, applies its
   * changes, then acknowledges. The cursor advances only after the
   * acknowledgement succeeds, so an interrupted pass is replayed and the
   * timeline dedupes by id. A pass superseded before its inbox is created or
   * read leaves the inbox untouched.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    if (signal.aborted) return;

    const inbox = await this.opener.openInboxShared(session, conversationId);

    if (signal.aborted) return;

    await this.readerSet.reconcile(session, inbox.keys, inbox.readers);

    if (signal.aborted) return;

    const { cursor, page } = await this.readPage(inbox);

    if (page.lastCursor <= cursor || signal.aborted) return;

    await this.applyPage(session, conversationId, inbox, page, signal, apply);
  }
}
