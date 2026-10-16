import type { MlsPrivateKeyPackage } from '@haskou/pigeon-swarm-crypto/mls';

export interface StoredMlsKeyPackage {
  /** The group it was published for; absent on packages stored before. */
  groupId?: string;
  id: string;
  privatePackage: MlsPrivateKeyPackage;
  publicBytes: Uint8Array;
}
