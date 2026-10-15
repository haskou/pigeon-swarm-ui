/**
 * Whether this device may speak in a group it holds. A group joined from
 * someone else's welcome waits for a valid commit or message from one of
 * its `confirmers`.
 */
export type GroupMailboxConfirmation =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly confirmers: readonly string[] };
