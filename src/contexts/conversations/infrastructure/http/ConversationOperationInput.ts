export interface ConversationOperationInput {
  action: string;
  args: Record<string, unknown>;
  conversationId: string;
  createdAt: number;
  networkId: string;
  /** Frontier the operation builds on; empty only for the genesis. */
  parents: string[];
}
