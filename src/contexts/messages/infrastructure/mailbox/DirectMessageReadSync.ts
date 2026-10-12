import type { Session } from '../../../identities/infrastructure/session/Session';
import type {
  MailboxChannel,
  OpenedMailboxPage,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageTimelineChange } from './DirectMessageTimelineChange';

import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMessageInboxKeys } from './DirectMessageInboxKeys';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';
import { DirectMessageRecordReader } from './DirectMessageRecordReader';

/**
 * Background read pass of the direct mailbox: clears unread from this
 * identity's own read receipts without acknowledging or moving the sync cursor.
 */
export class DirectMessageReadSync {
  public constructor(
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
  ) {}

  /** Reads only an inbox prewarm already opened, without a legacy readToken. */
  private readsAllowed(mailboxId: string, signal: AbortSignal): boolean {
    if (signal.aborted) return false;

    const stored = this.store.load(mailboxId);

    return stored !== null && !stored.readToken;
  }

  /** Saves the cursor when a page moved it forward, and returns the cursor. */
  private advanceReadCursor(
    mailboxId: string,
    cursor: number,
    lastCursor: number,
  ): number {
    if (lastCursor <= cursor) return cursor;

    this.store.saveReadCursor(mailboxId, lastCursor);

    return lastCursor;
  }

  /** Clears unread once the pass has reached the end of the inbox. */
  private clearUnread(
    pending: string | null,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): void {
    if (pending !== null) apply([{ kind: 'read', messageId: pending }]);
  }

  /**
   * The read a page leaves pending. A fresh read of this identity sets it, and
   * a sent message from another identity after it clears it, since that
   * message is unread. Other records leave it as it is.
   */
  private pendingRead(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
    pending: string | null,
  ): string | null {
    let next = pending;

    for (const envelope of page.envelopes) {
      const record = DirectMessageRecordReader.decode(
        session,
        conversationId,
        envelope.plaintext,
      );

      if (
        record?.type === 'read' &&
        DirectMessageRecordReader.isOwnFreshRead(session, record)
      ) {
        next = record.targetMessageId;
      } else if (
        record?.type === 'sent' &&
        !DirectMailboxOwnership.isAuthoredBy(
          record.authorId,
          session.identity.id,
        )
      ) {
        next = null;
      }
    }

    return next;
  }

  /**
   * Background pass for a conversation that no active pass reads. It clears
   * unread from this identity's own read receipts. It never acknowledges and
   * never moves the sync cursor: the active pass owns both. It opens and
   * decodes envelopes as the active pass does, keeps its own read cursor, and
   * builds no messages.
   *
   * A read clears unread only when no sent message from another identity
   * follows it, so an unread message is never hidden. A visit reads at most
   * READ_PAGE_LIMIT pages, and a clear applies only once it reaches the end of
   * the inbox. The pass reads only an inbox prewarm already opened on this
   * device, and never creates or adopts one.
   */
  public async syncReads(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const keys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      session.identity.id,
    );

    if (!this.readsAllowed(keys.mailboxId, signal)) return;

    const readers = DirectMessageInboxKeys.readersFor(session, keys);
    let cursor = this.store.loadReadCursor(keys.mailboxId) ?? 0;
    let pending: string | null = null;

    for (
      let visit = 0;
      visit < DirectMessageMailboxLimits.READ_PAGE_LIMIT;
      visit += 1
    ) {
      const page = await this.channel.read(
        keys,
        readers,
        cursor,
        DirectMessageMailboxLimits.PAGE_SIZE,
      );

      if (signal.aborted) return;

      if (page.recreated && cursor > 0) {
        // Re-created inbox: its envelopes number from 1 again.
        cursor = 0;
        pending = null;
        this.store.saveReadCursor(keys.mailboxId, cursor);
        continue;
      }

      pending = this.pendingRead(session, conversationId, page, pending);
      cursor = this.advanceReadCursor(keys.mailboxId, cursor, page.lastCursor);

      if (!page.hasMore) {
        this.clearUnread(pending, apply);

        return;
      }
    }
  }
}
