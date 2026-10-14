import type { CommunityOperation } from './operations/CommunityOperation';

import { CommunityOperationFold } from './operations/CommunityOperationFold';

/** The community permission to add and kick members. */
const MANAGE_MEMBERS = 'manage_members';

/**
 * The roster of one community, as the rules for its MLS group: who may hold
 * a leaf and who may change membership. It is replayed from the community's
 * signed operations, never taken from what a node says the roster is, and
 * judges a commit as of the revision the commit binds (see
 * `CommunityRosterHistory`). The managers are the owner and the members
 * whose roles grant `manage_members`. Only they add members. Any member may
 * remove an identity the roster no longer has (it left, was kicked or
 * banned); only a manager may remove one still on it, and never the owner.
 * Anyone on the roster may rotate their own leaf.
 */
export class CommunityMlsRoster {
  public static empty(): CommunityMlsRoster {
    return new CommunityMlsRoster(new Set(), undefined, new Set());
  }

  /**
   * The roster the community's verified operations prove, empty when they
   * prove no community: what the signed history does not prove is absent.
   */
  public static replay(
    operations: readonly CommunityOperation[],
  ): CommunityMlsRoster {
    const authority = CommunityOperationFold.fold(operations);

    if (!authority) return CommunityMlsRoster.empty();

    const members = authority.getMemberIds();

    return new CommunityMlsRoster(
      new Set(members),
      authority.getOwnerIdentityId(),
      new Set(
        members.filter((identityId) =>
          authority.hasPermission(identityId, MANAGE_MEMBERS),
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

  /** Whether both rosters let the same identities change membership. */
  public sameAuthorityAs(other: CommunityMlsRoster): boolean {
    return (
      this.ownerId === other.ownerId &&
      this.managers.size === other.managers.size &&
      [...this.managers].every((identityId) => other.managers.has(identityId))
    );
  }

  /** Every identity on the roster. */
  public participants(): string[] {
    return [...this.members];
  }
}
