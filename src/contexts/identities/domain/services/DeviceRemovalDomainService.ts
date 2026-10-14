import type { DeviceAuthorizationCheckpoint } from '../DeviceAuthorizationCheckpoint';
import type { OwnDeviceAuthorizationPort } from './OwnDeviceAuthorizationPort';

import { DeviceRemovedError } from '../DeviceRemovedError';

/**
 * Decides when this device counts as removed. A rejected credential means
 * removal only when the owner's catalog no longer lists this device. Any
 * other failure, including a failed catalog check, keeps the original error.
 */
export class DeviceRemovalDomainService {
  private static async isRemovedFromCatalog(
    port: OwnDeviceAuthorizationPort,
  ): Promise<boolean> {
    try {
      const own = port.ownCredential();
      const devices = await port.findCatalog();

      return !devices.some((device) => device.isEqual(own));
    } catch {
      return false;
    }
  }

  /** Reads the checkpoint, or rejects with DeviceRemovedError. */
  public static async findCheckpoint(
    port: OwnDeviceAuthorizationPort,
    identityId: string,
  ): Promise<DeviceAuthorizationCheckpoint> {
    try {
      return await port.findCheckpoint();
    } catch (error: unknown) {
      if (
        port.isCredentialRejection(error) &&
        (await DeviceRemovalDomainService.isRemovedFromCatalog(port))
      ) {
        throw new DeviceRemovedError(identityId);
      }

      throw error;
    }
  }
}
