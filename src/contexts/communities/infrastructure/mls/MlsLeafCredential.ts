import type { MlsLeafOwner } from './MlsGroup';

/** Public credential of one leaf: its owner and signature public key. */
export interface MlsLeafCredential {
  owner: MlsLeafOwner;
  signaturePublicKey: Uint8Array;
}
