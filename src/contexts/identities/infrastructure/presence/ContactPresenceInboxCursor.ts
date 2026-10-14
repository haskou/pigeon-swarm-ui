import { Timestamp } from '@haskou/value-objects';

/**
 * How far this device read one presence inbox in this app session, and the
 * updates it read that may still be current for the identity's other
 * devices. The inbox is cleared only up to the first update still current.
 */
export class ContactPresenceInboxCursor {
  private acknowledged = 0;
  private held: { clearAt: Timestamp; cursor: number }[] = [];
  private read = 0;

  public advance(cursor: number): void {
    this.read = Math.max(this.read, cursor);
  }

  /** The cursor to acknowledge at `now`, or null when nothing more clears. */
  public clearableAt(now: Timestamp): number | null {
    const current = this.held
      .filter(({ clearAt }) => clearAt.isAfter(now))
      .map(({ cursor }) => cursor);
    const upTo = current.length > 0 ? Math.min(...current) - 1 : this.read;

    return upTo > this.acknowledged ? upTo : null;
  }

  public cleared(upTo: number): void {
    this.acknowledged = Math.max(this.acknowledged, upTo);
    this.held = this.held.filter(({ cursor }) => cursor > upTo);
  }

  public hold(cursor: number, clearAt: Timestamp): void {
    this.held.push({ clearAt, cursor });
  }

  public position(): number {
    return this.read;
  }

  /** The inbox was created anew, so earlier cursors no longer apply. */
  public restart(): void {
    this.acknowledged = 0;
    this.held = [];
    this.read = 0;
  }
}
