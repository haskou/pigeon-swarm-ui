import type { DeviceAuthorizationCheckpoint } from '../DeviceAuthorizationCheckpoint';
import type { DeviceCredential } from '../value-objects/DeviceCredential';

/** Authorization reads for this device's identity. */
export interface OwnDeviceAuthorizationPort {
  /**
   * The owner's device catalog, read with the recovery proof, which does not
   * depend on this device's own credential.
   */
  findCatalog(): Promise<readonly DeviceCredential[]>;
  /** The checkpoint, read with this device's own credential. */
  findCheckpoint(): Promise<DeviceAuthorizationCheckpoint>;
  /** Whether a failure is the node rejecting this device's credential. */
  isCredentialRejection(error: unknown): boolean;
  ownCredential(): DeviceCredential;
}
