import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

/** A device sealed root and, on a hand-over, the root it replaced. */
export type DeviceSealedRoots = {
  previous?: SymmetricKey;
  root: SymmetricKey;
};
