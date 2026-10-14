export interface CommunityOperationPrimitives {
  action: string;
  args: Readonly<Record<string, unknown>>;
  authorIdentityId: string;
  communityId: string;
  createdAt: number;
  /** base64url sha256 of the canonical operation content. */
  hash: string;
  networkId: string;
  parents: readonly string[];
}
