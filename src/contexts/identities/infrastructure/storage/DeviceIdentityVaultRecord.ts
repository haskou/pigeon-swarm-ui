export type DeviceIdentityVaultRecord = {
  authorizationEpoch: string;
  authorizationRevision: number;
  createdAt: number;
  deviceId: string;
  encryptedMaterial: string;
  envelope: string;
  factorKey: CryptoKey;
  identityId: string;
  secretHandle: string;
  updatedAt: number;
  version: 2;
};
