/** The role every member holds, as the node assigns it. */
const EVERYONE = 'everyone';
/** The node's permission to kick members. */
const MANAGE_MEMBERS = 'manage_members';

/**
 * The node's roster of one community, as the rules for its MLS group: who
 * may hold a leaf and who may change membership. The managers are the owner
 * and the members whose roles grant `manage_members`, the node's rule for
 * kicking. Only they add members. Any member may remove an identity the
 * roster no longer has (it left, was kicked or banned); only a manager may
 * remove one still on it, and never the owner. Anyone on the roster may
 * rotate their own leaf.
 */
export class CommunityMlsRoster {
  public static empty(): CommunityMlsRoster {
    return new CommunityMlsRoster(new Set(), undefined, new Set());
  }

  public static of(community: {
    bannedMemberIds?: readonly string[];
    memberIds: readonly string[];
    memberRoles?: readonly {
      identityId: string;
      roleIds: readonly string[];
    }[];
    ownerIdentityId: string;
    roles?: readonly { id: string; permissions: readonly string[] }[];
  }): CommunityMlsRoster {
    const banned = new Set(community.bannedMemberIds ?? []);
    const members = new Set(
      community.memberIds.filter((identityId) => !banned.has(identityId)),
    );
    const managing = new Set(
      (community.roles ?? [])
        .filter((role) => role.permissions.includes(MANAGE_MEMBERS))
        .map((role) => role.id),
    );
    const rolesOf = (identityId: string): readonly string[] => [
      EVERYONE,
      ...(community.memberRoles?.find(
        (assignment) => assignment.identityId === identityId,
      )?.roleIds ?? []),
    ];

    return new CommunityMlsRoster(
      members,
      community.ownerIdentityId,
      new Set(
        [...members].filter(
          (identityId) =>
            identityId === community.ownerIdentityId ||
            rolesOf(identityId).some((roleId) => managing.has(roleId)),
        ),
      ),
    );
  }

  private constructor(
    private readonly members: ReadonlySet<string>,
    private readonly ownerId: string | undefined,
    private readonly managers: ReadonlySet<string>,
  ) {}

  /** Whether the committer may remove the identity from the MLS group. */
  private mayRemove(committer: string, target: string): boolean {
    return (
      !this.members.has(target) ||
      (this.managers.has(committer) && target !== this.ownerId)
    );
  }

  /** Whether the committer may make this change to the MLS group. */
  public allowsCommit(change: {
    added: readonly string[];
    committer: string;
    removed: readonly string[];
  }): boolean {
    const { added, committer, removed } = change;

    if (!this.members.has(committer)) return false;

    return (
      (added.length === 0 ||
        (this.managers.has(committer) &&
          added.every((identityId) => this.members.has(identityId)))) &&
      removed.every((identityId) => this.mayRemove(committer, identityId))
    );
  }

  /** Whether the identity may add members to the MLS group. */
  public manages(identityId: string): boolean {
    return this.managers.has(identityId);
  }

  public has(identityId: string): boolean {
    return this.members.has(identityId);
  }

  /** Every identity on the roster. */
  public participants(): string[] {
    return [...this.members];
  }
}
