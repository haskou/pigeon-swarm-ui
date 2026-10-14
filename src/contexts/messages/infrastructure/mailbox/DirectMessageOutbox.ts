import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageOutboxDelivery } from './DirectMessageOutboxDelivery';
import type { DirectMessageOutboxDraft } from './DirectMessageOutboxDraft';
import type { DirectMessageOutboxEvent } from './DirectMessageOutboxEvent';
import type { DirectMessageOutboxItem } from './DirectMessageOutboxItem';
import type { DirectMessageOutboxRow } from './DirectMessageOutboxRow';
import type { DirectMessageOutboxState } from './DirectMessageOutboxState';
import type { DirectMessageOutboxStore } from './DirectMessageOutboxStore';
import type { DirectMessageOutboxTicket } from './DirectMessageOutboxTicket';

import { MailboxUnavailableError } from '../../../mailboxes/domain/errors/MailboxUnavailableError';
import { DirectMessageOutboxEntry } from './DirectMessageOutboxEntry';

function entryKey(identityId: string, id: string): string {
  return `${identityId}\u0000${id}`;
}

/**
 * One-to-one sends that do not wait on each other. Each send is persisted
 * before its first attempt, then written to the peer and to the own inbox. A
 * send whose peer inbox is absent retries with backoff and no deadline while
 * the session lives. A fault marks the send failed until an explicit retry.
 * Counts and states are in memory; the rows are sealed in the store.
 */
export class DirectMessageOutbox {
  private readonly entries = new Map<string, DirectMessageOutboxEntry>();
  private readonly listeners = new Set<
    (event: DirectMessageOutboxEvent) => void
  >();

  public constructor(
    private readonly store: Pick<
      DirectMessageOutboxStore,
      'forget' | 'load' | 'remove' | 'save'
    >,
    private readonly delivery: DirectMessageOutboxDelivery,
  ) {}

  private notify(event: DirectMessageOutboxEvent = { kind: 'changed' }): void {
    for (const listener of this.listeners) listener(event);
  }

  private register(
    session: Session,
    row: DirectMessageOutboxRow,
  ): DirectMessageOutboxEntry {
    const entry = new DirectMessageOutboxEntry(session, row);

    this.entries.set(entryKey(entry.identityId, row.id), entry);

    return entry;
  }

  private setState(
    entry: DirectMessageOutboxEntry,
    state: DirectMessageOutboxState,
  ): void {
    if (entry.transition(state)) this.notify();
  }

  private async persist(
    entry: DirectMessageOutboxEntry,
    row: DirectMessageOutboxRow,
  ): Promise<void> {
    entry.replaceRow(row);
    await this.store.save(entry.session, row);
  }

  /**
   * Retries the peer copy while the peer inbox is absent. Resolves false when
   * the send was cancelled meanwhile; rejects on any other failure.
   */
  private async deliverToPeer(
    entry: DirectMessageOutboxEntry,
  ): Promise<boolean> {
    for (;;) {
      if (entry.cancelled) return false;

      this.setState(entry, 'pending');

      try {
        await this.delivery.toPeer(entry.session, entry.row);

        return true;
      } catch (error) {
        if (!(error instanceof MailboxUnavailableError)) throw error;
      }

      this.setState(entry, 'retry');

      const delayMs = entry.nextRetryDelayMs();

      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, delayMs);
      });
    }
  }

  private async drain(entry: DirectMessageOutboxEntry): Promise<void> {
    try {
      if (!entry.row.peerDelivered) {
        const delivered = await this.deliverToPeer(entry);

        if (!delivered) return;

        await this.persist(entry, { ...entry.row, peerDelivered: true });
      }

      this.setState(entry, 'pending');
      await this.delivery.toOwn(entry.session, entry.row);

      if (entry.cancelled) return;

      await this.store.remove(entry.identityId, entry.row.id);
      this.entries.delete(entryKey(entry.identityId, entry.row.id));
      entry.settled.resolve();
      this.notify({
        conversationId: entry.row.conversationId,
        id: entry.row.id,
        kind: 'delivered',
      });
    } catch (error) {
      if (entry.cancelled) return;

      entry.transition('failed');
      await this.persist(entry, { ...entry.row, state: 'failed' }).catch(
        () => undefined,
      );
      entry.settled.reject(error);
      this.notify();
    }
  }

  private forIdentity(identityId: string): DirectMessageOutboxEntry[] {
    return [...this.entries.values()].filter(
      (entry) => entry.identityId === identityId,
    );
  }

  /**
   * Persists the send, then starts its delivery. Resolves once the row is
   * stored; rejects, with no delivery attempted, when the row cannot be stored.
   */
  public async enqueue(
    session: Session,
    draft: DirectMessageOutboxDraft,
  ): Promise<DirectMessageOutboxTicket> {
    const row: DirectMessageOutboxRow = {
      conversationId: draft.conversationId,
      id: draft.record.id,
      peerDelivered: false,
      peerIdentityId: draft.peerIdentityId,
      record: draft.record,
      state: 'pending',
    };

    await this.store.save(session, row);

    const entry = this.register(session, row);

    this.notify();
    void this.drain(entry);

    return { delivered: entry.settled.promise };
  }

  /**
   * Restarts a failed send with the same record id. Undefined when the send is
   * not queued; the caller then resends the message under the same id.
   */
  public retry(
    session: Session,
    id: string,
  ): DirectMessageOutboxTicket | undefined {
    const entry = this.entries.get(entryKey(session.identity.id, id));

    if (!entry) return undefined;

    if (entry.state !== 'failed') return { delivered: entry.settled.promise };

    entry.restart();
    this.notify();
    void this.store.save(session, entry.row).catch(() => undefined);
    void this.drain(entry);

    return { delivered: entry.settled.promise };
  }

  /**
   * Loads this identity's persisted sends and resumes them. A row already
   * written to the peer goes straight to the own inbox. A failed row waits for
   * an explicit retry.
   */
  public async resume(session: Session): Promise<void> {
    const rows = await this.store.load(session);

    for (const row of rows) {
      if (this.entries.has(entryKey(session.identity.id, row.id))) continue;

      const entry = this.register(session, row);

      if (row.state !== 'failed') void this.drain(entry);
    }

    this.notify();
  }

  /** Sends of one conversation, in memory. Each carries its state. */
  public items(
    identityId: string,
    conversationId: string,
  ): DirectMessageOutboxItem[] {
    return this.forIdentity(identityId)
      .filter((entry) => entry.row.conversationId === conversationId)
      .map((entry) => ({
        conversationId,
        id: entry.row.id,
        record: entry.row.record,
        state: entry.state,
      }));
  }

  /** Notifies on each state change. Returns the unsubscribe function. */
  public subscribe(
    listener: (event: DirectMessageOutboxEvent) => void,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Stops this identity's in-memory sends without wiping them, for logout.
   * The rows stay sealed in the store and resume at the next unlock.
   */
  public stop(identityId: string): void {
    for (const entry of this.forIdentity(identityId)) {
      entry.cancel();
      this.entries.delete(entryKey(identityId, entry.row.id));
    }

    this.notify();
  }

  /**
   * Cancels this identity's sends and wipes their rows, for forget. Every
   * pending ticket rejects. The wipe never throws.
   */
  public async cancel(identityId: string): Promise<void> {
    for (const entry of this.forIdentity(identityId)) {
      entry.cancel();
      this.entries.delete(entryKey(identityId, entry.row.id));
      entry.settled.reject(new Error('Direct outbox send cancelled.'));
    }

    this.notify();
    await this.store.forget(identityId);
  }
}
