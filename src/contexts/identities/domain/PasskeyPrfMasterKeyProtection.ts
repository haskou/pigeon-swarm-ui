export type PasskeyPrfMasterKeyProtection = {
  algorithm: 'webauthn-prf';
  credentialId: string;
  encryptedPasswordKey: string;
  keyAlgorithm: 'aes-256-gcm';
  salt: string;
  version: 1;
};
