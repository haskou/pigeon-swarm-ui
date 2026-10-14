import type { DeviceAuthorizationEpoch } from '../value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../value-objects/DeviceAuthorizationRevision';

/** The epoch and revision this device last verified. */
export interface LocalDeviceAuthorizationCheckpoint {
  epoch: DeviceAuthorizationEpoch;
  revision: DeviceAuthorizationRevision;
}
