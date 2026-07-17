import type { KeyPair, SymmetricKey } from '@haskou/value-objects';

export type IdentityCreationMaterial = {
  keyPair: KeyPair;
  masterKey: SymmetricKey;
};
