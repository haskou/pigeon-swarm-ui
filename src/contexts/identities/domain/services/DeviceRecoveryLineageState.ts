import type { DeviceAuthorization } from '../DeviceAuthorization';
import type { DeviceCompromiseCaps } from '../DeviceCompromiseCaps';

/** The authorization and compromise caps after one recovery of a lineage. */
export interface DeviceRecoveryLineageState {
  authorization: DeviceAuthorization;
  compromiseCaps: DeviceCompromiseCaps;
}
