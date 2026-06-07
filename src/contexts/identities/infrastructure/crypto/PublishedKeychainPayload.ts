export type PublishedKeychainPayload = {
  encryptedPayload: string;
  previousKeychainExternalIdentifier: null | string;
  signature: string;
  timestamp: number;
  version: number;
};
