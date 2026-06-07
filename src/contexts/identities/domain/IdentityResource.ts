export type IdentityResource = {
  encryptedKeyPair: {
    encryptedPrivateKey: string;
    publicKey: string;
  };
  id: string;
  identityExternalIdentifier?: string | null;
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
