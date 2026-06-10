import type { EncryptedKeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from './IdentityResource';
import type { LocalKeychain } from './LocalKeychain';

export type Session = {
  encryptedKeyPair: EncryptedKeyPair;
  identity: IdentityResource;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  masterKey: SymmetricKey;
  password: string;
};
