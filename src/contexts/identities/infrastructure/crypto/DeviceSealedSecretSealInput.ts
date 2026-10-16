import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';

export type DeviceSealedSecretSealInput = {
  authorizationRevision: number;
  generation: number;
  identityId: string;
  payload: string;
  publisher: KeyPair;
  recipients: readonly DeviceCredential[];
};
