import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

/** A device sealed root and, after a revoke or hand-over, the replaced one. */
export type DeviceSealedRoots = {
  previous?: SymmetricKey;
  root: SymmetricKey;
};
