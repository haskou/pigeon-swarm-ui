import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

export type DevicePairingCompletionMaterialResource = {
  historyTransferSecret: string;
  identityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  recoveryAuthorityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  rootKey: string;
  version: 1;
};
