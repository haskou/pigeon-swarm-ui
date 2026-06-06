import type { EncryptedKeyPair } from '@haskou/value-objects';

import type { IdentityResource } from './IdentityResource';
import type { LocalKeychain } from './LocalKeychain';

export type Session = {
  encryptedKeyPair: EncryptedKeyPair;
  identity: IdentityResource;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  password: string;
};
