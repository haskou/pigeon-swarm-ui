import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';
import type {
  DirectMessageOutboxRow,
  DirectMessageOutboxStore,
} from './DirectMessageOutboxStore';

import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';

/**
 * Writes one copy of a queued send. Throws MailboxUnavailableError while the
 * peer inbox is absent.
 */
export type DirectMessageOutboxDelivery = {
  toPeer(session: Session, row: DirectMessageOutboxRow): Promise<void>;
  toOwn(session: Session, row: DirectMessageOutboxRow): Promise<void>;
};

export type DirectMessageOutboxDraft = {
  conversationId: string;
  peerIdentityId: string;
  record: DirectSentRecord;
};

export type DirectMessageOutboxTicket = {
  delivered: Promise<void>;
};

/** `retry` is the wait after an absent peer inbox. It is in memory only. */
export type DirectMessageOutboxState = 'failed' | 'pending' | 'retry';

/**
 * What changed. `delivered` names the send that left the queue, so a view can
 * drop its pending state. `changed` is any other state change.
 */
export type DirectMessageOutboxEvent =
  | { kind: 'changed' }
  | { conversationId: string; id: string; kind: 'delivered' };

export type DirectMessageOutboxItem = {
  conversationId: string;
  id: string;
  record: DirectSentRecord;
  state: DirectMessageOutboxState;
};

type OutboxStore = Pick<
  DirectMessageOutboxStore,
  'forget' | 'load' | 'remove' | 'save'
>;

type Settlement = {
  promise: Promise<void>;
  reject: (reason?: unknown) => void;
  resolve: () => void;
};

type Entry = {
  attempt: number;
  cancelled: boolean;
  identityId: string;
  row: DirectMessageOutboxRow;
  session: Session;
  settled: Settlement;
  startedAt: number;
  state: DirectMessageOutboxState;
};

/** An absent peer inbox is retried quickly for this long, then slowly. */
const FAST_RETRY_WINDOW_MS = 30_000;
const FIRST_RETRY_MS = 250;
const FAST_RETRY_CAP_MS = 4_000;
const SLOW_RETRY_MS = 60_000;

function entryKey(identityId: string, id: string): string {
  return `${identityId}\u0000${id}`;
}

function retryDelayMs(elapsedMs: number, attempt: number): number {
  if (elapsedMs >= FAST_RETRY_WINDOW_MS) return SLOW_RETRY_MS;

  return Math.min(FIRST_RETRY_MS * 2 ** attempt, FAST_RETRY_CAP_MS);
}

/**
 * One-to-one sends that do not wait on each other. Each send is persisted
 * before its first attempt, then written to the peer and to the own inbox. A
 * send whose peer inbox is absent retries with backoff and no deadline while
 * the session lives. A fault marks the send failed until an explicit retry.
 * Counts and states are in memory; the rows are sealed in the store.
 */
export class DirectMessageOutbox {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<
    (event: DirectMessageOutboxEvent) => void
  >();

  public constructor(
    private readonly store: OutboxStore,
    private readonly delivery: DirectMessageOutboxDelivery,
  ) {}

  private notify(event: DirectMessageOutboxEvent = { kind: 'changed' }): void {
    for (const listener of this.listeners) listener(event);
  }

  private newSettlement(): Settlement {
    let resolve: () => void = () => undefined;
    let reject: (reason?: unknown) => void = () => undefined;
    const promise = new Promise<void>((done, fail) => {
      resolve = () => done();
      reject = (reason) => fail(reason);
    });

    // A rejected ticket is handled by its caller; this only avoids an
    // unhandled rejection when nobody holds the ticket.
    promise.catch(() => undefined);

    return { promise, reject, resolve };
  }

  private register(session: Session, row: DirectMessageOutboxRow): Entry {
    const entry: Entry = {
      attempt: 0,
      cancelled: false,
      identityId: session.identity.id,
      row,
      session,
      settled: this.newSettlement(),
      startedAt: Date.now(),
      state: row.state === 'failed' ? 'failed' : 'pending',
    };

    this.entries.set(entryKey(entry.identityId, row.id), entry);

    return entry;
  }

  private setState(entry: Entry, state: DirectMessageOutboxState): void {
    if (entry.state === state) return;

    entry.state = state;
    this.notify();
  }

  private async persist(
    entry: Entry,
    row: DirectMessageOutboxRow,
  ): Promise<void> {
    entry.row = row;
    await this.store.save(entry.session, row);
  }

  /**
   * Retries the peer copy while the peer inbox is absent. Resolves false when
   * the send was cancelled meanwhile; rejects on any other failure.
   */
  private async deliverToPeer(entry: Entry): Promise<boolean> {
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

      await new Promise<void>((resolve) => {
        globalThis.setTimeout(
          resolve,
          retryDelayMs(Date.now() - entry.startedAt, entry.attempt),
        );
      });
      entry.attempt += 1;
    }
  }

  private async drain(entry: Entry): Promise<void> {
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

      entry.state = 'failed';
      await this.persist(entry, { ...entry.row, state: 'failed' }).catch(
        () => undefined,
      );
      entry.settled.reject(error);
      this.notify();
    }
  }

  private forIdentity(identityId: string): Entry[] {
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

    entry.settled = this.newSettlement();
    entry.attempt = 0;
    entry.startedAt = Date.now();
    entry.state = 'pending';
    entry.row = { ...entry.row, state: 'pending' };
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
      entry.cancelled = true;
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
      entry.cancelled = true;
      this.entries.delete(entryKey(identityId, entry.row.id));
      entry.settled.reject(new Error('Direct outbox send cancelled.'));
    }

    this.notify();
    await this.store.forget(identityId);
  }
}
