/** A role of a community as its signed operations define it. */
export interface CommunityRoleGrant {
  builtIn: boolean;
  id: string;
  permissions: readonly string[];
}
