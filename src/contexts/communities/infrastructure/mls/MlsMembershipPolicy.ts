/** A commit's effect on membership, by identity. */
export interface MlsMembershipChange {
  /** The identity whose leaf made the commit. */
  readonly committer: string;
  /** The device credential of the leaf that made the commit. */
  readonly committerDevice: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Who may hold a leaf and who may change membership. It must be answered
 * from the roster the node keeps, never from the MLS tree itself, at the
 * roster revision (`MlsRosterFrontier`) a commit or welcome binds: a commit
 * made while its committer was allowed stays allowed in whatever order a
 * member learns of later roster changes.
 */
export interface MlsMembershipPolicy {
  /** The roster revision this device's commits and welcomes bind. */
  frontier(): readonly string[];
  /** Whether the identity may hold a leaf in the roster at the revision. */
  admits(identityId: string, frontier: readonly string[]): boolean;
  /**
   * How much of the roster history the revision stands for, the same on
   * every member. Of two commits for one epoch, the one binding more wins,
   * so a member cannot outrun a newer revision with an older one.
   */
  reach(frontier: readonly string[]): number;
  /**
   * Whether the committer may make this change in the roster at the
   * revision the commit binds (`frontier`). That revision must include the
   * one the group bound before (`baseline`), so no commit is judged by a
   * roster older than one the group already followed.
   */
  allows(
    change: MlsMembershipChange,
    order: { baseline: readonly string[]; frontier: readonly string[] },
  ): boolean;
  /**
   * Whether a commit proves roster operations the node has not served this
   * device: it binds a revision naming one this device has not verified,
   * and its committer may add members in the latest roster this device has
   * verified. The node may be withholding a demotion that revision holds.
   */
  withheld(committer: string, frontier: readonly string[]): boolean;
}
