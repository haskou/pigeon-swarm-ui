import type { DeviceAuthorizationCompromisedCredentialResource } from './DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationOperation } from './DeviceAuthorizationOperation';

export type DeviceAuthorizationUnsignedPayload = {
  authorCredential?: string;
  authorizedAt?: number;
  compromisedCredentials?: DeviceAuthorizationCompromisedCredentialResource[];
  compromisedSince?: number;
  epoch: string;
  identityId: string;
  operation: DeviceAuthorizationOperation;
  operationId: string;
  pairingExpiration?: number;
  pairingId?: string;
  previousRevision: number;
  revision: number;
  targetCredential: string;
  targetCredentialCommitment: string;
};
