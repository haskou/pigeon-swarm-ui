import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

/** An identity that signs community operations in specs. */
export interface CommunityOperationAuthor {
  id: string;
  keyPair: KeyPair;
}
