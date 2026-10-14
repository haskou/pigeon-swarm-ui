import type { DeviceAuthorization } from '../DeviceAuthorization';
import type { DeviceAuthorizationCandidate } from '../DeviceAuthorizationCandidate';

/** The accepted transitions of a replay and every state they produced. */
export interface DeviceAuthorizationReplay {
  accepted: DeviceAuthorizationCandidate[];
  states: DeviceAuthorization[];
}
