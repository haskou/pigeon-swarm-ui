import type { MlsLeafCredential } from './MlsLeafCredential';

/** Public credentials of the leaves of one group, for audit display. */
export interface MlsGroupCredentials {
  epoch: bigint;
  leaves: MlsLeafCredential[];
}
