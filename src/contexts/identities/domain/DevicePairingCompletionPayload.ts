export type DevicePairingCompletionPayload = {
  authorCredential: string;
  encryptedMaterial: string;
  epoch: string;
  identityId: string;
  operationId: string;
  pairingId: string;
  revision: number;
  version: 1;
};
