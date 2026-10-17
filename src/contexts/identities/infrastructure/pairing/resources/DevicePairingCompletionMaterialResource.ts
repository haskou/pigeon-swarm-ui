import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

export type DevicePairingCompletionMaterialResource = {
  /** Oldest record time, in ms, the new device keeps. */
  historyFloor: number;
  historyTransferSecret: string;
  identityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  recoveryAuthorityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  rootKey: string;
  version: 1;
};
