export interface SignedPublicMutation {
  author: { deviceCredential: string; identityId: string };
  kind: 'delete' | 'put';
  operationId: string;
  payloadDigest: string;
  predecessor: null | string;
  recordId: string;
  sequence: number;
  signature: string;
  store: string;
  version: 1;
}
