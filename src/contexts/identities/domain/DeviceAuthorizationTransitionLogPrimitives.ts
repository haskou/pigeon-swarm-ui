import type { DeviceAuthorizationTransitionPrimitives } from './DeviceAuthorizationTransitionPrimitives';

export interface DeviceAuthorizationTransitionLogPrimitives {
  concurrentRecoveries: DeviceAuthorizationTransitionPrimitives[];
  identityId: string;
  recoveries: DeviceAuthorizationTransitionPrimitives[];
  transitions: DeviceAuthorizationTransitionPrimitives[];
}
