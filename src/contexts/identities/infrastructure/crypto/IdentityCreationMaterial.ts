import type { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

export type IdentityCreationMaterial = {
  deviceCredentialKeyPair: KeyPair;
  keyPair: KeyPair;
  masterKey: SymmetricKey;
  recoveryAuthorityKeyPair: KeyPair;
};
