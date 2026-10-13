import type { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from './value-objects/DeviceCredential';

export type DeviceAuthorizationCompromisedCredential = {
  compromisedSince: DeviceAuthorizationRevision;
  credential: DeviceCredential;
};
