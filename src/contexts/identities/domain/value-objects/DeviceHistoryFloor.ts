import { Timestamp } from '@haskou/value-objects';

/**
 * The oldest message time a paired device keeps, set by the device that
 * authorized it. A record created before it is neither copied to the new
 * device nor stored or shown there. It is what the app copies and shows, not
 * a cryptographic limit: the paired device holds the identity root.
 */
export class DeviceHistoryFloor {
  /**
   * How far a sender's clock may lag the authorizer's: a record that reaches
   * the inbox dated this much before the floor is still kept, so a message
   * sent right after the pairing is never dropped.
   */
  private static readonly CLOCK_SKEW_MINUTES = 5;

  /** Keeps every record. */
  public static readonly OPEN = new DeviceHistoryFloor(new Timestamp(0));

  public static at(at: Timestamp): DeviceHistoryFloor {
    return new DeviceHistoryFloor(at);
  }

  public static fromPrimitives(value: number): DeviceHistoryFloor {
    return new DeviceHistoryFloor(new Timestamp(value));
  }

  /**
   * Whether a floor read from a pairing completion is usable: a whole number
   * of milliseconds, not before the epoch, and not past `now` beyond the
   * clock skew.
   */
  public static isReceivable(value: number, now: Timestamp): boolean {
    return (
      Number.isSafeInteger(value) &&
      value >= 0 &&
      new Timestamp(value).isBeforeOrEqual(
        now.addMinutes(DeviceHistoryFloor.CLOCK_SKEW_MINUTES),
      )
    );
  }

  private constructor(private readonly floor: Timestamp) {}

  /** A stored record the authorizer copies, by its own clock. */
  public admits(createdAt: Timestamp): boolean {
    return createdAt.isAfterOrEqual(this.floor);
  }

  /** A record that reaches the new device's inbox, dated by its sender. */
  public admitsDelivered(createdAt: Timestamp): boolean {
    return createdAt.isAfterOrEqual(
      this.floor.addMinutes(-DeviceHistoryFloor.CLOCK_SKEW_MINUTES),
    );
  }

  public toPrimitives(): number {
    return this.floor.toMilliseconds();
  }
}
