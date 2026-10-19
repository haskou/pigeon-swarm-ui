export type DeviceIdentityVaultRecord = {
  authorizationEpoch: string;
  authorizationRevision: number;
  createdAt: number;
  deviceId: string;
  encryptedMaterial: string;
  envelope: string;
  factorKey: CryptoKey;
  firstKeychainPublishPending?: boolean;
  identityId: string;
  secretHandle: string;
  updatedAt: number;
  version: 2;
};
