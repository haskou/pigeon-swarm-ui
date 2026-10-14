/** What one sync of a group conversation found about this identity. */
export type GroupConversationSyncOutcome = {
  /** The node's roster no longer lists this identity. */
  removed: boolean;
};
