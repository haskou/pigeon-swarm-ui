import type { DeviceRootRowKeys } from '@haskou/pigeon-swarm-crypto';

/**
 * What a `DeviceSealedRowStore` settles its canary record for: the row keys
 * of the session's root, of the root it replaced, and the generation of the
 * publication the session's root came from, when known.
 */
export type DeviceSealedRowRoots = {
  readonly current: DeviceRootRowKeys;
  readonly generation?: number;
  readonly replaced?: DeviceRootRowKeys;
};
