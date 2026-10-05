export interface CommunityOperationInput {
  action: string;
  args: Record<string, unknown>;
  communityId: string;
  createdAt: number;
  networkId: string;
  /** Frontier the operation builds on; empty only for the genesis. */
  parents: string[];
}
