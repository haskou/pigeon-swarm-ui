import type { DevicePasskeyCredential } from '../crypto/DevicePasskeyCredential';

export type DeviceIdentityVaultRecord = {
  authorizationEpoch: string;
  authorizationRevision: number;
  createdAt: number;
  deviceId: string;
  encryptedMaterial: string;
  envelope: string;
  factorKey: CryptoKey;
  identityId: string;
  /** Present when a passkey, not a password, unlocks this device. */
  passkey?: DevicePasskeyCredential;
  secretHandle: string;
  updatedAt: number;
  version: 2;
};
