import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectEditedRecord } from '../../../mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { DirectReadRecord } from '../../../mailboxes/domain/DirectReadRecord';
import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';
import type { OpenedMailboxPage } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { ChatMessage } from '../../presentation/view-models/ChatMessage';
import type { DirectMessageTimelineChange } from '../../presentation/view-models/DirectMessageTimelineChange';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { DirectMessageHistoryStore } from './DirectMessageHistoryStore';
import type { DirectMessageInboxOpener } from './DirectMessageInboxOpener';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';
import type { DirectMessageRecipientInbox } from './DirectMessageRecipientInbox';

import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageHistoryStorageError } from './DirectMessageHistoryStorageError';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageRecordReader } from './DirectMessageRecordReader';

/**
 * Recipient sync pass of the direct mailbox: reads the next page of this
 * identity's inbox, maps it to timeline changes, then acknowledges it.
 */
export class DirectMessageTimelineSync {
  private readonly applied = new Map<string, Set<string>>();

  public constructor(
    private readonly opener: DirectMessageInboxOpener,
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly readerSet: DirectMessageReaderSet,
    private readonly projection: Pick<MessageProjectionPort, 'decryptMany'>,
    private readonly ownCopies: DirectMessageOwnCopies,
    private readonly history: DirectMessageHistoryStore,
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
   * Decodes the page, stores its records on this device, then hands the
   * changes of records this timeline has not applied yet to the caller, then
   * acknowledges the page. The store runs before the ack, so an acked page is
   * never missing from the history. A page the store cannot hold is still
   * shown but not acknowledged, and the pass rejects with
   * `DirectMessageHistoryStorageError`. Each step checks the signal so an
   * aborted pass neither applies nor acks.
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
    const decoded = page.envelopes.flatMap((envelope) => {
      const record = DirectMessageRecordReader.decode(
        session,
        conversationId,
        envelope.plaintext,
      );

      return record ? [{ plaintext: envelope.plaintext, record }] : [];
    });

    // Keyed by record id, so a replayed envelope dedupes while each action
    // (a reaction add, its removal, a re-add) keeps its own row.
    const stored = await this.history
      .append(
        session,
        conversationId,
        decoded.flatMap(({ plaintext, record }) =>
          record.type === DirectMailboxRecords.TYPE.read
            ? []
            : [{ plaintext, recordId: record.id }],
        ),
      )
      .then(
        () => true,
        () => false,
      );

    if (signal.aborted) return;

    // An own copy this device appended is already shown locally.
    const records = decoded.flatMap(({ record }) =>
      this.ownCopies.has(
        DirectMailboxOwnership.ownCopyKey(session.identity.id, record.id),
      )
        ? []
        : [record],
    );
    const unapplied = this.unappliedRecords(conversationId, records);
    const changes = await this.changesFor(
      session,
      conversationId,
      unapplied,
      signal,
    );

    if (signal.aborted) return;

    apply(changes);
    this.markApplied(conversationId, unapplied);

    if (signal.aborted) return;

    // An unstored page stays on the node: the next pass reads it again, stores
    // it, and acks it. Its records are applied, so the replay adds no change.
    if (!stored) throw new DirectMessageHistoryStorageError();

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
   * Records this timeline has not applied yet, each id once. A replayed
   * envelope carries a record id this timeline already holds.
   */
  private unappliedRecords(
    conversationId: string,
    records: DirectMessageRecord[],
  ): DirectMessageRecord[] {
    const applied = this.appliedIn(conversationId);
    const unapplied = new Map<string, DirectMessageRecord>();

    for (const record of records) {
      if (!applied.has(record.id) && !unapplied.has(record.id)) {
        unapplied.set(record.id, record);
      }
    }

    return [...unapplied.values()];
  }

  /** Remembers the records this timeline applied, so a replay adds nothing. */
  private markApplied(
    conversationId: string,
    records: DirectMessageRecord[],
  ): void {
    const applied = this.appliedIn(conversationId);

    for (const record of records) applied.add(record.id);
  }

  /** Record ids this timeline has applied, per conversation. */
  private appliedIn(conversationId: string): Set<string> {
    const applied = this.applied.get(conversationId) ?? new Set<string>();

    this.applied.set(conversationId, applied);

    return applied;
  }

  /**
   * Maps records to timeline changes, in record order. A sent or edited record
   * whose message does not decrypt drops only its own change. Deletes and
   * reactions carry no ciphertext and never decrypt.
   */
  private async changesFor(
    session: Session,
    conversationId: string,
    records: DirectMessageRecord[],
    signal: AbortSignal,
  ): Promise<DirectMessageTimelineChange[]> {
    const messages = await this.decryptMessages(
      session,
      conversationId,
      records,
      signal,
    );

    return records.flatMap((record): DirectMessageTimelineChange[] => {
      switch (record.type) {
        case DirectMailboxRecords.TYPE.sent:
        case DirectMailboxRecords.TYPE.edited:
          return this.messageChanges(record, messages);
        case DirectMailboxRecords.TYPE.deleted:
          return [{ kind: 'removed', messageId: record.targetMessageId }];
        case DirectMailboxRecords.TYPE.reaction:
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
        case DirectMailboxRecords.TYPE.pin:
          return [
            {
              action: record.action,
              createdAt: record.createdAt,
              kind: 'pin',
              messageId: record.targetMessageId,
            },
          ];
        case DirectMailboxRecords.TYPE.read:
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
      record.type === DirectMailboxRecords.TYPE.sent
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
      DirectMailboxRecords.carriesMessage(record)
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
   * timeline skips records it already applied. A pass superseded before its
   * inbox is created or read leaves the inbox untouched.
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

  /**
   * Replays this device's stored history of the conversation as one batch of
   * changes, in the order it was stored. Read receipts are never stored, so
   * none replay. Own copies replay too: the live pass skips them only because
   * they were already on screen when it appended them.
   * Replayed records then count as applied, so a later pass skips them.
   */
  public async restore(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    if (signal.aborted) return;

    const plaintexts = await this.history.load(session, conversationId);
    const records = plaintexts.flatMap((plaintext) => {
      const record = DirectMessageRecordReader.decode(
        session,
        conversationId,
        plaintext,
      );

      return record ? [record] : [];
    });
    const changes = await this.changesFor(
      session,
      conversationId,
      records,
      signal,
    );

    if (signal.aborted) return;

    apply(changes);
    this.markApplied(conversationId, records);
  }
}
