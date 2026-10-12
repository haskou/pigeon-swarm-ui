import type { DeviceAuthorizationCompromisedCredentialResource } from './DeviceAuthorizationCompromisedCredential';

export type DeviceAuthorizationCheckpointResource = {
  compromisedCredentials?: DeviceAuthorizationCompromisedCredentialResource[];
  epoch: string;
  identityId: string;
  revision: number;
};
