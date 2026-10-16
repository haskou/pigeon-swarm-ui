/**
 * What one transaction that settles a `DeviceSealedRowStore` canary record
 * decided: whether it refused a replaced root, and the counts of a re-seal,
 * when it ran one.
 */
export type DeviceSealedSettlement = {
  readonly dropped?: number;
  readonly refused: boolean;
  readonly resealed?: number;
};
