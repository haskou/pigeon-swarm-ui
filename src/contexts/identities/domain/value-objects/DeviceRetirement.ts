import { Enum } from '@haskou/value-objects';

enum DeviceRetirementPrimitive {
  ALREADY_REVOKED = 'already-revoked',
  LAST_DEVICE = 'last-device',
  REVOKED = 'revoked',
}

/**
 * How the node answered a request to retire this device's own credential.
 * The node never revokes the only credential of an identity: that answer is
 * LAST_DEVICE, and the credential stays authorized.
 */
export class DeviceRetirement extends Enum<string> {
  public static readonly ALREADY_REVOKED = new DeviceRetirement(
    DeviceRetirementPrimitive.ALREADY_REVOKED,
  );

  public static readonly LAST_DEVICE = new DeviceRetirement(
    DeviceRetirementPrimitive.LAST_DEVICE,
  );

  public static readonly REVOKED = new DeviceRetirement(
    DeviceRetirementPrimitive.REVOKED,
  );

  public static fromPrimitives(value: string): DeviceRetirement {
    return new DeviceRetirement(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(DeviceRetirementPrimitive);
  }

  public isLastDevice(): boolean {
    return this.isEqual(DeviceRetirement.LAST_DEVICE);
  }
}
