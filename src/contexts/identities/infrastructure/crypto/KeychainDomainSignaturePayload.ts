export type KeychainDomainSignaturePayload = {
  encryptedPayload: string;
  ownerIdentityId: string;
  previousKeychainExternalIdentifier?: string;
  timestamp: number;
  version: number;
};
