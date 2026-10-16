/**
 * The identity's canary in a `DeviceSealedRowStore`, sealed under the current
 * root's keys, and one canary per root it replaced, each sealed under that
 * root's keys, so a replaced root is recognised without storing it or
 * anything derived from it alone.
 */
export type DeviceSealedCanaryRecord = {
  readonly retired?: readonly Uint8Array[];
  readonly sealed: Uint8Array;
};
