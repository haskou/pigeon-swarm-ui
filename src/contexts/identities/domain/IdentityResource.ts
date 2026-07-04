import type { PasskeyPrfMasterKeyProtection } from './PasskeyPrfMasterKeyProtection';

export type IdentityResource = {
  encryptedKeyPair: {
    encryptedPrivateKey: string;
    publicKey: string;
  };
  encryptedMasterKey: string;
  id: string;
  identityExternalIdentifier?: string | null;
  masterKeyDerivation: {
    N: number;
    algorithm: 'scrypt';
    p: number;
    passkeyPrf?: PasskeyPrfMasterKeyProtection;
    r: number;
    recoveryKey?: {
      algorithm: 'pigeon-recovery-key';
      encryptedMasterKey: string;
      mode: 'password-recovery' | 'recovery-key';
      version: 1;
    };
    salt: string;
    version: 1;
  };
  networks: string[];
  previousIdentityExternalIdentifier?: string | null;
  profile: {
    biography?: string | null;
    banner?: string | null;
    handle?: string | null;
    name: string;
    picture?: string | null;
  };
  signature: string;
  timestamp: number;
  version: number;
};
