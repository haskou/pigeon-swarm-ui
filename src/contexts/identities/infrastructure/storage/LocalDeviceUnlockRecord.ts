export type LocalDeviceUnlockRecord = {
  createdAt: number;
  deviceKey: CryptoKey;
  encryptedPayload: ArrayBuffer;
  identityId: string;
  identityVersion: number;
  iv: ArrayBuffer;
  keychainVersion: number;
  updatedAt: number;
};
