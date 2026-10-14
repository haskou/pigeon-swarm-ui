import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectEditedRecord } from '../../../mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { DirectReadRecord } from '../../../mailboxes/domain/DirectReadRecord';
import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';
import type { OpenedMailboxPage } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { ChatMessage } from '../../domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../domain/DirectMessageTimelineChange';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { DirectMessageAvailability } from './DirectMessageAvailability';
import type { DirectMessageHistoryStore } from './DirectMessageHistoryStore';
import type { DirectMessageInboxSource } from './DirectMessageInboxSource';
import type { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import type { DirectMessageRecipientInbox } from './DirectMessageRecipientInbox';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageHistoryStorageError } from './DirectMessageHistoryStorageError';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageRecordReader } from './DirectMessageRecordReader';

/**
 * Recipient sync pass of the direct mailbox: reads the next page of this
 * identity's inbox, maps it to timeline changes, then acknowledges it. The
 * inbox is read on the connected node and on every availability server; a
 * record replicated on several is applied once.
 */
export class DirectMessageTimelineSync {
  /**
   * Per source and mailbox, the cursor up to which pages past an unstored
   * page were shown this app session. Never saved: those pages stay on the
   * node until stored in order.
   */
  private readonly ahead = new Map<
    DirectMessageInboxSource,
    Map<string, number>
  >();

  private readonly applied = new Map<string, Set<string>>();

  public constructor(
    private readonly primary: DirectMessageInboxSource,
    private readonly extras: readonly DirectMessageInboxSource[],
    private readonly projection: Pick<MessageProjectionPort, 'decryptReadable'>,
    private readonly ownCopies: DirectMessageOwnCopies,
    private readonly history: DirectMessageHistoryStore,
    private readonly availability: Pick<DirectMessageAvailability, 'receive'>,
  ) {}

  /**
   * Reads from the stored cursor. An inbox re-created under that cursor
   * numbers its envelopes from 1 again, so it is read again from zero. The
   * reset is saved before the second read, so a crash cannot leave the new
   * inbox behind the old cursor.
   */
  private async readPage(
    source: DirectMessageInboxSource,
    inbox: DirectMessageRecipientInbox,
  ): Promise<{ cursor: number; page: OpenedMailboxPage }> {
    const { keys, readers, state } = inbox;
    const page = await source.channel.read(
      keys,
      readers,
      state.cursor,
      DirectMessageMailboxLimits.PAGE_SIZE,
    );

    if (!page.recreated || state.cursor === 0) {
      return { cursor: state.cursor, page };
    }

    source.store.save(keys.mailboxId, { ...state, cursor: 0 });
    this.aheadIn(source).delete(keys.mailboxId);

    return {
      cursor: 0,
      page: await source.channel.read(
        keys,
        readers,
        0,
        DirectMessageMailboxLimits.PAGE_SIZE,
      ),
    };
  }

  /**
   * Decodes the page, stores its records on this device, shows them, then
   * acknowledges the page. The store runs before the ack, so an acked page is
   * never missing from the history. A page the store cannot hold is still
   * shown but not acknowledged; the page after it is read ahead and shown
   * too, and the pass rejects with `DirectMessageHistoryStorageError`. Each
   * step checks the signal so an aborted pass neither applies nor acks.
   */
  private async applyPage(
    session: Session,
    conversationId: string,
    source: DirectMessageInboxSource,
    inbox: DirectMessageRecipientInbox,
    page: OpenedMailboxPage,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const { keys, readers, state } = inbox;
    const records = this.decode(session, conversationId, page);
    const stored = await this.store(session, conversationId, records);

    if (signal.aborted) return;

    await this.show(session, conversationId, records, signal, apply);

    if (signal.aborted) return;

    // An unstored page stays on the node: the next pass reads it again, stores
    // it, and acks it. Its records are applied, so the replay adds no change.
    if (!stored) {
      await this.readAhead(
        session,
        conversationId,
        source,
        inbox,
        page,
        signal,
        apply,
      ).catch(() => {
        // eslint-disable-next-line no-console
        console.debug('Direct mailbox read-ahead failed.');
      });

      throw new DirectMessageHistoryStorageError();
    }

    const acked = await source.channel.acknowledge(
      keys,
      readers,
      page.lastCursor,
    );
    const cursor = acked.recreated ? 0 : page.lastCursor;
    const ahead = this.aheadIn(source);

    source.store.save(keys.mailboxId, { ...state, cursor });

    if (acked.recreated || (ahead.get(keys.mailboxId) ?? 0) <= cursor) {
      ahead.delete(keys.mailboxId);
    }
  }

  /**
   * Reads and shows the next page past the furthest one shown, so a page this
   * device cannot store does not hide the messages after it. The page is
   * neither stored nor acknowledged: the history keeps the inbox order, and
   * the page is stored and acked in turn once the pages before it are. One
   * page per pass, like the acknowledged read.
   */
  private async readAhead(
    session: Session,
    conversationId: string,
    source: DirectMessageInboxSource,
    inbox: DirectMessageRecipientInbox,
    unstored: OpenedMailboxPage,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    if (!unstored.hasMore) return;

    const { keys, readers } = inbox;
    const ahead = this.aheadIn(source);
    const after = Math.max(unstored.lastCursor, ahead.get(keys.mailboxId) ?? 0);
    const page = await source.channel.read(
      keys,
      readers,
      after,
      DirectMessageMailboxLimits.PAGE_SIZE,
    );

    if (signal.aborted) return;

    // A re-created inbox numbers from 1 again; the next pass reads it from 0.
    if (page.recreated) {
      ahead.delete(keys.mailboxId);

      return;
    }

    if (page.lastCursor <= after) return;

    await this.show(
      session,
      conversationId,
      this.decode(session, conversationId, page),
      signal,
      apply,
    );

    if (signal.aborted) return;

    ahead.set(keys.mailboxId, page.lastCursor);
  }

  /**
   * The records of a page. An envelope that is no record may be an
   * availability announcement from the peer.
   */
  private decode(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
  ): { plaintext: Uint8Array; record: DirectMessageRecord }[] {
    return page.envelopes.flatMap((envelope) => {
      const record = DirectMessageRecordReader.decode(
        session,
        conversationId,
        envelope.plaintext,
      );

      if (!record) {
        this.availability.receive(session, conversationId, envelope.plaintext);
      }

      return record ? [{ plaintext: envelope.plaintext, record }] : [];
    });
  }

  /**
   * Stores the records on this device, keyed by record id, so a replayed
   * envelope dedupes while each action (a reaction add, its removal, a
   * re-add) keeps its own row. Read receipts are never stored. Whether the
   * write succeeded.
   */
  private store(
    session: Session,
    conversationId: string,
    records: { plaintext: Uint8Array; record: DirectMessageRecord }[],
  ): Promise<boolean> {
    return this.history
      .append(
        session,
        conversationId,
        records.flatMap(({ plaintext, record }) =>
          record.type === DirectMailboxRecords.TYPE.read
            ? []
            : [{ plaintext, recordId: record.id }],
        ),
      )
      .then(
        () => true,
        () => false,
      );
  }

  /**
   * Hands the changes of records this timeline has not applied yet to the
   * caller. An own copy this device appended is already shown locally.
   */
  private async show(
    session: Session,
    conversationId: string,
    decoded: { record: DirectMessageRecord }[],
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const records = decoded.flatMap(({ record }) =>
      this.ownCopies.has(
        DirectMailboxOwnership.ownCopyKey(
          IdentityId.fromString(session.identity.id),
          record.id,
        ),
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
  }

  /**
   * One source's pass: open, reconcile readers, read a page, apply it. An
   * availability server whose inbox did not open is skipped this pass.
   */
  private async syncSource(
    source: DirectMessageInboxSource,
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    if (signal.aborted) return;

    const inbox = await source.opener.openInboxShared(session, conversationId);

    if (signal.aborted) return;

    if (source !== this.primary && inbox.outcome !== 'open') return;

    await source.readerSet.reconcile(session, inbox.keys, inbox.readers);

    if (signal.aborted) return;

    const { cursor, page } = await this.readPage(source, inbox);

    if (page.lastCursor <= cursor || signal.aborted) return;

    await this.applyPage(
      session,
      conversationId,
      source,
      inbox,
      page,
      signal,
      apply,
    );
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

  /** Read-ahead cursors of one source, by mailbox id. */
  private aheadIn(source: DirectMessageInboxSource): Map<string, number> {
    const ahead = this.ahead.get(source) ?? new Map<string, number>();

    this.ahead.set(source, ahead);

    return ahead;
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
        default:
          // Polls exist only in group conversations.
          return [];
      }
    });
  }

  /**
   * A sent or edited record yields a change only when its message could be
   * read; the projection leaves an unreadable message out.
   */
  private messageChanges(
    record: DirectEditedRecord | DirectSentRecord,
    messages: Map<string, ChatMessage>,
  ): DirectMessageTimelineChange[] {
    const message = messages.get(record.id);

    if (!message) return [];

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
   * message id, holding only the messages that could be read. Makes no call
   * when the page has none.
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

    const messages = await this.projection.decryptReadable(
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
   * inbox is created or read leaves the inbox untouched. The availability
   * servers are read after the connected node, even when it failed; its
   * error is rethrown once they are done. A page a server's read cannot
   * store rethrows `DirectMessageHistoryStorageError` instead, so the notice
   * shows; their other faults log count-only.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    let failure: { error: unknown } | undefined;

    try {
      await this.syncSource(
        this.primary,
        session,
        conversationId,
        signal,
        apply,
      );
    } catch (error: unknown) {
      failure = { error };
    }

    for (const extra of this.extras) {
      try {
        await this.syncSource(extra, session, conversationId, signal, apply);
      } catch (error: unknown) {
        if (error instanceof DirectMessageHistoryStorageError) {
          failure = { error };
        } else {
          // eslint-disable-next-line no-console
          console.debug('Availability mailbox sync failed.');
        }
      }
    }

    if (failure) throw failure.error;
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
