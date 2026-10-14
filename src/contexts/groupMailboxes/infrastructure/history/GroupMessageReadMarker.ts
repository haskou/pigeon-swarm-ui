import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { GroupMessageReadMarkerPrimitives } from './GroupMessageReadMarkerPrimitives';

import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { GroupMessageId } from '../crypto/GroupMessageId';

/**
 * How far this device accounted one group conversation's stored history:
 * `through` is the highest row sequence accounted, `unread` the ids of the
 * messages of other members since the last read, kept up to MAX_IDS so a
 * deletion can withdraw one, and `extra` the count past that cap.
 * `latestAt` is the creation time of the newest message, clamped to the
 * time it was accounted so a skewed clock cannot pin a group on top.
 */
export class GroupMessageReadMarker {
  private static readonly MAX_IDS = 200;

  /**
   * Adds a message of another member to `unread` unless it is there; returns
   * 1 when the cap left it out, so the caller counts it, else 0.
   */
  private static added(
    unread: string[],
    record: DirectMessageRecord,
    identityId: string,
  ): number {
    if (record.authorId === identityId || unread.includes(record.id)) return 0;

    if (unread.length >= GroupMessageReadMarker.MAX_IDS) return 1;
    unread.push(record.id);

    return 0;
  }

  private static isCount(value: unknown): value is number {
    return (
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
  }

  private static isIds(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.length <= GroupMessageReadMarker.MAX_IDS &&
      (value as unknown[]).every((id) => typeof id === 'string')
    );
  }

  /** Removes from `unread` the message a deletion by its author targets. */
  private static withdrawn(
    unread: string[],
    record: DirectMessageRecord,
  ): void {
    if (
      record.type !== DirectMailboxRecords.TYPE.deleted ||
      !GroupMessageId.belongsTo(record.targetMessageId, record.authorId)
    ) {
      return;
    }
    const index = unread.indexOf(record.targetMessageId);

    if (index >= 0) unread.splice(index, 1);
  }

  /** A marker that counts every row up to `through` as read. */
  public static fresh(
    through: number,
    latestAt: number,
  ): GroupMessageReadMarker {
    return new GroupMessageReadMarker(through, [], 0, latestAt);
  }

  /** The marker of stored primitives; undefined when they are malformed. */
  public static parse(value: unknown): GroupMessageReadMarker | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const { extra, latestAt, through, unread } =
      value as Partial<GroupMessageReadMarkerPrimitives>;

    if (
      !GroupMessageReadMarker.isCount(through) ||
      !GroupMessageReadMarker.isCount(extra) ||
      !GroupMessageReadMarker.isCount(latestAt) ||
      !GroupMessageReadMarker.isIds(unread)
    ) {
      return undefined;
    }

    return new GroupMessageReadMarker(through, unread, extra, latestAt);
  }

  private constructor(
    private readonly through: number,
    private readonly unread: readonly string[],
    private readonly extra: number,
    private readonly latestAt: number,
  ) {}

  /**
   * Accounts `records`, the rows after `through` up to `lastSequence` in
   * arrival order, for `identityId`. A message of another member is unread;
   * a deletion by its author withdraws it. Edits, reactions and pins never
   * count.
   */
  public accounted(
    lastSequence: number,
    records: readonly DirectMessageRecord[],
    identityId: string,
    now: number,
  ): GroupMessageReadMarker {
    const unread = [...this.unread];
    let { extra, latestAt } = this;

    for (const record of records) {
      if (record.type === DirectMailboxRecords.TYPE.sent) {
        latestAt = Math.max(latestAt, Math.min(record.createdAt, now));
        extra += GroupMessageReadMarker.added(unread, record, identityId);
      } else {
        GroupMessageReadMarker.withdrawn(unread, record);
      }
    }

    return new GroupMessageReadMarker(
      Math.max(this.through, lastSequence),
      unread,
      extra,
      latestAt,
    );
  }

  public equals(other: GroupMessageReadMarker | undefined): boolean {
    return (
      other !== undefined &&
      other.through === this.through &&
      other.extra === this.extra &&
      other.latestAt === this.latestAt &&
      other.unread.length === this.unread.length &&
      other.unread.every((id, index) => id === this.unread[index])
    );
  }

  /** The highest row sequence accounted. */
  public lastSequence(): number {
    return this.through;
  }

  /** The creation time of the newest message, if any was accounted. */
  public latestMessageAt(): number | undefined {
    return this.latestAt > 0 ? this.latestAt : undefined;
  }

  /** Every row up to `through` read, with nothing unread. */
  public read(through: number): GroupMessageReadMarker {
    return new GroupMessageReadMarker(
      Math.max(this.through, through),
      [],
      0,
      this.latestAt,
    );
  }

  public toPrimitives(): GroupMessageReadMarkerPrimitives {
    return {
      extra: this.extra,
      latestAt: this.latestAt,
      through: this.through,
      unread: [...this.unread],
    };
  }

  public unreadCount(): number {
    return this.unread.length + this.extra;
  }
}
