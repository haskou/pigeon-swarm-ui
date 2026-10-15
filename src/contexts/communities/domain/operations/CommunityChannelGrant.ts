/** A channel of a community and the roles that may see it, as signed. */
export interface CommunityChannelGrant {
  readonly id: string;
  visibleRoleIds: readonly string[];
}
