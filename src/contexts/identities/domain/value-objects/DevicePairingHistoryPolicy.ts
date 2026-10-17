import { Enum, Timestamp } from '@haskou/value-objects';

import { DeviceHistoryFloor } from './DeviceHistoryFloor';

enum DevicePairingHistoryPolicyPrimitive {
  ALL = 'all',
  LAST_30_DAYS = 'last-30-days',
  NONE = 'none',
}

/** How much message history the authorizing device lets a new device keep. */
export class DevicePairingHistoryPolicy extends Enum<string> {
  private static readonly WINDOW_DAYS = 30;

  public static readonly ALL = new DevicePairingHistoryPolicy(
    DevicePairingHistoryPolicyPrimitive.ALL,
  );

  public static readonly LAST_30_DAYS = new DevicePairingHistoryPolicy(
    DevicePairingHistoryPolicyPrimitive.LAST_30_DAYS,
  );

  public static readonly NONE = new DevicePairingHistoryPolicy(
    DevicePairingHistoryPolicyPrimitive.NONE,
  );

  /** Applies when the person leaves the choice alone. */
  public static readonly DEFAULT = DevicePairingHistoryPolicy.LAST_30_DAYS;

  public static fromPrimitives(value: string): DevicePairingHistoryPolicy {
    return new DevicePairingHistoryPolicy(value);
  }

  private constructor(value: string) {
    super(value);
  }

  /** The floor of the new device's history, from the authorizer's clock. */
  public floorAt(now: Timestamp): DeviceHistoryFloor {
    if (this.isEqual(DevicePairingHistoryPolicy.ALL)) {
      return DeviceHistoryFloor.OPEN;
    }

    if (this.isEqual(DevicePairingHistoryPolicy.NONE)) {
      return DeviceHistoryFloor.at(now);
    }

    return DeviceHistoryFloor.at(
      now.addDays(-DevicePairingHistoryPolicy.WINDOW_DAYS),
    );
  }

  public getValues(): string[] {
    return Object.values(DevicePairingHistoryPolicyPrimitive);
  }
}
