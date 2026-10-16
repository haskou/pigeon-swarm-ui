import type { MlsGroupLeaf } from '@haskou/pigeon-swarm-crypto/mls';

/** Public credentials of the leaves of one group, for audit display. */
export interface MlsGroupCredentials {
  epoch: bigint;
  leaves: MlsGroupLeaf[];
}
