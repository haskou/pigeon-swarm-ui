import type { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from '../http/resources/IdentityResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';

export type Session = {
  identity: IdentityResource;
  keyPair: KeyPair;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  masterKey: SymmetricKey;
};
