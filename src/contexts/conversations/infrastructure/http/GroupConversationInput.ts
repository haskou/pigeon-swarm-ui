export type GroupConversationInput = {
  name: string;
  networkId: string;
  /** Client randomness the group id commits to. */
  nonce: string;
  participantIds: string[];
};
