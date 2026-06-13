import type { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from './IdentityResource';
import type { LocalKeychain } from './LocalKeychain';

export type Session = {
  identity: IdentityResource;
  keyPair: KeyPair;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  masterKey: SymmetricKey;
  password: string;
};
