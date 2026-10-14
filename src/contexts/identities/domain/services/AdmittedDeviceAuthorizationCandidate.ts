import type { DeviceAuthorization } from '../DeviceAuthorization';
import type { DeviceAuthorizationCandidate } from '../DeviceAuthorizationCandidate';

/** A candidate the policy admits, with the authorization it leads to. */
export interface AdmittedDeviceAuthorizationCandidate {
  authorization: DeviceAuthorization;
  candidate: DeviceAuthorizationCandidate;
}
