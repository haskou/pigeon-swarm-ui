/** What one sync of a group conversation found about this identity. */
export type GroupConversationSyncOutcome = {
  /** The node's roster no longer lists this identity. */
  removed: boolean;
  /**
   * This device holds the group but no confirming member has spoken in it
   * yet, so it sends nothing there.
   */
  unconfirmed: boolean;
};
