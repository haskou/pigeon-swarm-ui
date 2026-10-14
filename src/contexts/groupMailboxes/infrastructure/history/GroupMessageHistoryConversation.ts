import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';

/**
 * The opened records of one conversation held in memory: the latest
 * arrivals as one contiguous run, oldest first, plus records looked up one
 * by one. `floor` is the oldest stored sequence read so far; `complete`
 * tells that every stored row was read.
 */
export class GroupMessageHistoryConversation {
  private readonly byId = new Map<string, DirectMessageRecord>();
  private complete = false;
  private readonly run: DirectMessageRecord[] = [];
  private lowest = Number.POSITIVE_INFINITY;

  public constructor(public readonly tag: string) {}

  /**
   * Adds a record stored as `sequence`, after every record held. The first
   * one held sets the floor, so later pages read only rows below it.
   */
  public addNewer(record: DirectMessageRecord, sequence: number): void {
    this.run.push(record);
    this.byId.set(record.id, record);
    this.lowest = Math.min(this.lowest, sequence);
  }

  /**
   * Adds the opened records of the rows read below `floor`, oldest first.
   * `exhausted` tells that no stored row is older.
   */
  public addOlder(
    records: readonly DirectMessageRecord[],
    floor: number,
    exhausted: boolean,
  ): void {
    this.run.unshift(...records);
    for (const record of records) this.byId.set(record.id, record);
    this.lowest = Math.min(this.lowest, floor);
    this.complete = exhausted;
  }

  public find(id: string): DirectMessageRecord | undefined {
    return this.byId.get(id);
  }

  public floor(): number {
    return this.lowest;
  }

  public isComplete(): boolean {
    return this.complete;
  }

  /** The latest `limit` arrivals, ordered by creation time. */
  public latest(limit: number): DirectMessageRecord[] {
    return this.run
      .slice(-limit)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  /** How many older rows a page of `limit` still needs. */
  public missing(limit: number): number {
    return this.complete ? 0 : Math.max(0, limit - this.run.length);
  }

  /** Keeps a record looked up on its own, outside the run. */
  public remember(record: DirectMessageRecord): void {
    this.byId.set(record.id, record);
  }
}
