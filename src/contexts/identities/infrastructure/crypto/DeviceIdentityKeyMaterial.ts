import type { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

export type DeviceIdentityKeyMaterial = {
  deviceCredentialKeyPair: KeyPair;
  identityKeyPair: KeyPair;
  recoveryAuthorityKeyPair: KeyPair;
  rootKey: UserRootKey;
};
