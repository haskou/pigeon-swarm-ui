import type { DevicePairingCompletion } from '../../domain/DevicePairingCompletion';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { Session } from '../session/Session';

export interface DevicePairingAuthorization {
  completion: DevicePairingCompletion;
  /** The credential of the device this authorization enrols. */
  credential: DeviceCredential;
  session: Session;
}
