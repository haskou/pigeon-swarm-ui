export type EncryptedCommunityKey = {
  algorithm: 'AES-GCM';
  ciphertext: string;
  nonce: string;
  version: 1;
};
