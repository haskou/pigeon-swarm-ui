import type { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

export type IdentityCreationMaterial = {
  keyPair: KeyPair;
  masterKey: SymmetricKey;
};
