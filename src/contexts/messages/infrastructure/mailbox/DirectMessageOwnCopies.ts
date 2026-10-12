import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';

/**
 * Own copies this instance appended, keyed by identity and record id. A
 * replayed own copy is acknowledged but not applied: this device already
 * shows the action, and a stale replay could undo a later local delete.
 * Bounded by OWN_COPY_LIMIT; an evicted key applies again on replay.
 */
export class DirectMessageOwnCopies {
  private readonly ids = new Set<string>();

  public has(id: string): boolean {
    return this.ids.has(id);
  }

  /** Remembers an own copy so its replay is not applied. Bounded. */
  public remember(id: string): void {
    this.ids.add(id);

    if (this.ids.size > DirectMessageMailboxLimits.OWN_COPY_LIMIT) {
      // Insertion order: the first id is the oldest own copy.
      const [oldest] = this.ids;

      this.ids.delete(oldest);
    }
  }
}
