/** What one sync of a group conversation found about this identity. */
export type GroupConversationSyncOutcome = {
  /**
   * This device refused its last add to the group because the welcome would
   * not fit a control record, and no add's welcome has fit since: the
   * invitee stays on the roster without a leaf.
   */
  outgrown: boolean;
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
