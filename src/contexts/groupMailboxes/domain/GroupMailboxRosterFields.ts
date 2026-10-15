/**
 * The roster of a group conversation as its MLS group carries it in the
 * GroupContext: who is in the group, who manages it and what it is called.
 */
export type GroupMailboxRosterFields = Readonly<{
  adminIds: readonly string[];
  conversationId: string;
  creatorId: string;
  memberIds: readonly string[];
  name: string;
  version: number;
}>;
