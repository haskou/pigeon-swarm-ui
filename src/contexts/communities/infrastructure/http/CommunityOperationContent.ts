/** What the author signs: the operation without its id and signature. */
export interface CommunityOperationContent {
  action: string;
  args: Record<string, unknown>;
  authorIdentityId: string;
  communityId: string;
  createdAt: number;
  networkId: string;
  parents: string[];
  scopeType: 'community_operation';
}
