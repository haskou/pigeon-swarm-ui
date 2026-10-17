import { Timestamp } from '@haskou/value-objects';

/**
 * The oldest stored message time the authorizing device copies to a new
 * device. It bounds only that export: records the node still holds reach the
 * new device's inboxes whatever the floor, and the new device holds the
 * identity root, so it is what the app copies, not a cryptographic limit.
 */
export class DeviceHistoryFloor {
  /** The furthest millisecond a `Date` can hold on either side of the epoch. */
  private static readonly DATE_LIMIT_MS = 8_640_000_000_000_000;

  /** Copies every record. */
  public static readonly OPEN = new DeviceHistoryFloor(new Timestamp(0));

  public static at(at: Timestamp): DeviceHistoryFloor {
    return new DeviceHistoryFloor(at);
  }

  private constructor(private readonly floor: Timestamp) {}

  /**
   * A stored record the authorizer copies, by its own clock. A `createdAt`
   * that is no whole millisecond within the `Date` range is never copied.
   */
  public admits(createdAt: number): boolean {
    return (
      Number.isSafeInteger(createdAt) &&
      Math.abs(createdAt) <= DeviceHistoryFloor.DATE_LIMIT_MS &&
      createdAt >= this.floor.toMilliseconds()
    );
  }

  public toPrimitives(): number {
    return this.floor.toMilliseconds();
  }
}
