import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

/**
 * Re-seals the group history from the device-sealed root a session replaced
 * under its current root, within the transaction that settles the canary
 * record (`GroupMessageHistoryDatabase.settle`).
 */
export type GroupMessageHistoryResealer = {
  /**
   * The read marker of conversation tag `from`, re-sealed for its tag `to`
   * under the current root; undefined when it does not open.
   */
  readonly read: (
    from: string,
    to: string,
    sealed: Uint8Array,
  ) => Uint8Array | undefined;
  /**
   * The row re-sealed under the current root, with its tags under that root;
   * undefined when it does not open under the replaced one.
   */
  readonly row: (
    row: GroupMessageHistoryRow,
  ) => GroupMessageHistoryRow | undefined;
};
