export type DeviceIdentityVaultRecord = {
  authorizationEpoch: string;
  authorizationRevision: number;
  createdAt: number;
  deviceId: string;
  encryptedMaterial: string;
  envelope: string;
  factorKey: CryptoKey;
  firstKeychainPublish?: FirstKeychainPublishState;
  identityId: string;
  secretHandle: string;
  updatedAt: number;
  version: 2;
};

/**
 * First keychain publish of an identity created on this device. `armed` lets
 * its first keychain post without a head. `ambiguous` means a post may have
 * been accepted without an answer, so a head-less post needs proof of absence.
 * An absent field reads as `none`.
 */
export type FirstKeychainPublishState = 'none' | 'armed' | 'ambiguous';
