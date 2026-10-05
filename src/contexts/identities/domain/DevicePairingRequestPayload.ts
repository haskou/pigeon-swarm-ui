export type DevicePairingRequestPayload = {
  authorizedAt: number;
  invitation: string;
  operationId: string;
  proofOfPossession: string;
  targetCredential: string;
  transportPublicKey: string;
  version: 1;
};
