import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

export type SerializedDeviceIdentityKeyMaterial = {
  deviceCredentialKeyPair: ReturnType<KeyPair['toPrimitives']>;
  identityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  recoveryAuthorityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  version: 1;
};
