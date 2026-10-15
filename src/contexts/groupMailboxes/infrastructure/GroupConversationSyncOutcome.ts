/** What one sync of a group conversation found about this identity. */
export type GroupConversationSyncOutcome = {
  /**
   * The roster this device's group carries no longer lists this identity,
   * or this device holds no group for the conversation (never welcomed, or
   * removed from it).
   */
  removed: boolean;
  /**
   * This device holds the group but no confirming member has spoken in it
   * yet, so it sends nothing there.
   */
  unconfirmed: boolean;
};
