import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

export type DevicePairingCompletionMaterialResource = {
  identityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  recoveryAuthorityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  rootKey: string;
  version: 1;
};
