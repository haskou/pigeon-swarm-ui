import type { DeviceAuthorizationTransition } from './DeviceAuthorizationTransition';

/**
 * A transition with the exact encoding the node served, the protocol
 * tie-break between transitions sharing an operation id.
 */
export interface DeviceAuthorizationCandidate {
  encoding: string;
  transition: DeviceAuthorizationTransition;
}
