import type { DeviceAuthorizationTransition } from '../../domain/DeviceAuthorizationTransition';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';

/** This device's own revocation, prepared but not yet submitted. */
export type OwnDeviceRevocation = {
  remaining: DeviceCredential[];
  transition: DeviceAuthorizationTransition;
};
