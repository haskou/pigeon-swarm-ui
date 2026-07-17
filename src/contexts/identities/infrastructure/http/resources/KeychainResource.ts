export type KeychainResource = {
  encryptedPayload: string;
  keychainExternalIdentifier: string;
  ownerIdentityId: string;
  previousKeychainExternalIdentifier?: string | null;
  signature: string;
  timestamp: number;
  version: number;
};
