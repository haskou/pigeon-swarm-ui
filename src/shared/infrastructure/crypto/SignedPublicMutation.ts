export interface SignedPublicMutation {
  author: {
    authorizationRevision: number;
    deviceCredential: string;
    identityId: string;
  };
  frontier?: string[];
  kind: 'delete' | 'put';
  operationId: string;
  payloadDigest: string;
  predecessor: null | string;
  recordId: string;
  sequence: number;
  signature: string;
  store: string;
  version: 2;
}
